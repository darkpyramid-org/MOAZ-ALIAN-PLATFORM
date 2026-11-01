using ApiServer.Application.Abstractions;
using ApiServer.Application.Common;
using ApiServer.Application.Contracts.Categories;
using ApiServer.Application.Contracts.Content;
using ApiServer.Application.Services;
using ApiServer.Application.Tests.Fakes;
using ApiServer.Application.Validation;
using ApiServer.Domain.Entities;
using ApiServer.Domain.Enums;
using Microsoft.Extensions.Options;

namespace ApiServer.Application.Tests.Services;

public sealed class ContentServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

    private readonly FakeContentRepository contents = new();

    private readonly FakeCategoryRepository categories = new();

    private readonly FakeContentReader reader;

    private readonly FakeCurrentUser user = new();

    private readonly FakeCacheVersion cacheVersion = new();

    private readonly FakeReadThroughCache cache = new();

    private readonly FakeUnitOfWork unitOfWork = new();

    public ContentServiceTests()
    {
        reader = new FakeContentReader(contents.Items);
        categories.Store.Add(Category.Create("aqeedah", "العقيدة", null, 1, Now));
    }

    private ContentService CreateService() => new(
        contents,
        reader,
        categories,
        unitOfWork,
        user,
        new FixedClock(Now),
        cache,
        cacheVersion,
        new UpsertContentItemRequestValidator(),
        Options.Create(new ContentCacheOptions()));

    private static UpsertContentItemRequest ArticleRequest(string title = "ردود العقيدة") => new()
    {
        Type = ContentType.Article,
        Title = title,
        Body = "نص المحاضرة",
        CategoryIds = ["aqeedah"],
    };

    // ---------- authorisation ----------

    [Fact]
    public async Task Create_WithoutEditorRole_IsForbidden()
    {
        var viewer = new FakeCurrentUser { CanEditContent = false };
        var service = new ContentService(
            contents, reader, categories, unitOfWork, viewer,
            new FixedClock(Now), cache, cacheVersion,
            new UpsertContentItemRequestValidator(), Options.Create(new ContentCacheOptions()));

        await Assert.ThrowsAsync<ForbiddenException>(() => service.CreateAsync(ArticleRequest(), CancellationToken.None));
        Assert.Empty(contents.Items);
    }

    // ---------- create ----------

    [Fact]
    public async Task Create_PersistsReadBackAndBumpsCacheVersion()
    {
        var service = CreateService();
        var before = cacheVersion.Current;

        var dto = await service.CreateAsync(ArticleRequest(), CancellationToken.None);

        Assert.Single(contents.Items);
        Assert.Equal(1, unitOfWork.SaveCount);
        Assert.True(cacheVersion.Current > before, "a write must invalidate cached reads");
        Assert.Equal("ردود-العقيدة", dto.Slug);
        Assert.Equal("aqeedah", Assert.Single(dto.CategoryIds));
    }

    [Fact]
    public async Task Create_DuplicateSlug_IsConflict()
    {
        var service = CreateService();
        await service.CreateAsync(ArticleRequest(), CancellationToken.None);

        await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(ArticleRequest(), CancellationToken.None));
        Assert.Single(contents.Items);
    }

    [Fact]
    public async Task Create_UnknownCategory_IsNotFound_AndNothingIsSaved()
    {
        var service = CreateService();
        var request = ArticleRequest() with { CategoryIds = ["does-not-exist"] };

        var notFound = await Assert.ThrowsAsync<NotFoundException>(() => service.CreateAsync(request, CancellationToken.None));

        Assert.Equal("Category", notFound.ResourceName);
        Assert.Empty(contents.Items);
        Assert.Equal(0, unitOfWork.SaveCount);
    }

    [Fact]
    public async Task Create_MalformedRequest_IsValidationFailure()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() =>
            service.CreateAsync(ArticleRequest() with { CategoryIds = [] }, CancellationToken.None));
    }

    // ---------- read paths ----------

    [Fact]
    public async Task Get_UnknownSlug_IsNotFound()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(ContentType.Book, "nope", CancellationToken.None));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Get_BlankSlug_IsNotFoundWithoutQuery(string? slug)
    {
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(ContentType.Article, slug, CancellationToken.None));
        Assert.Equal(0, reader.QueryCount);
    }

    [Fact]
    public async Task List_SecondIdenticalCall_HitsCacheInsteadOfDatabase()
    {
        var service = CreateService();

        await service.ListAsync(new ContentQuery(), CancellationToken.None);
        await service.ListAsync(new ContentQuery(), CancellationToken.None);

        Assert.Equal(1, reader.QueryCount);
    }

    [Fact]
    public async Task List_AfterWriteKeyChanges_ServesFreshData()
    {
        var service = CreateService();
        await service.ListAsync(new ContentQuery(), CancellationToken.None);

        await service.CreateAsync(ArticleRequest(), CancellationToken.None);
        await service.ListAsync(new ContentQuery(), CancellationToken.None);

        // 2 = the version bump made the first entry's key unreachable, forcing a fresh read.
        Assert.Equal(2, reader.QueryCount);
    }

    [Fact]
    public async Task List_OversizedPageSize_IsClampedNotRejected()
    {
        var service = CreateService();
        PagedResult<ContentSummaryDto>? served = null;
        reader.OnQuery = query =>
        {
            served = new PagedResult<ContentSummaryDto>([], query.Page, query.PageSize, 0);
            return served;
        };

        await service.ListAsync(new ContentQuery { Page = 0, PageSize = 5000 }, CancellationToken.None);

        Assert.NotNull(served);
        Assert.Equal(1, served!.Page);
        Assert.Equal(ContentQuery.MaxPageSize, served.PageSize);
    }

    // ---------- snapshot ----------

    [Fact]
    public async Task Snapshot_ReturnsFullDetailRecordsNewestFirst()
    {
        var service = CreateService();
        await service.CreateAsync(ArticleRequest(title: "القديم") with { PublishedAt = Now.AddDays(-30) }, CancellationToken.None);
        var newest = await service.CreateAsync(ArticleRequest(title: "الجديد") with { PublishedAt = Now }, CancellationToken.None);

        var snapshot = await service.GetSnapshotAsync(CancellationToken.None);

        Assert.Equal(2, snapshot.Count);
        Assert.Equal(newest.Id, snapshot[0].Id);
        // Detail, not summary — the frontend hydration pool needs the body it renders with.
        Assert.All(snapshot, item => Assert.Equal("نص المحاضرة", item.Body));
    }

    [Fact]
    public async Task Snapshot_SecondCallIsCachedUntilAWriteBumpsTheVersion()
    {
        var service = CreateService();
        await service.CreateAsync(ArticleRequest(), CancellationToken.None);

        await service.GetSnapshotAsync(CancellationToken.None);
        await service.GetSnapshotAsync(CancellationToken.None);
        Assert.Equal(1, reader.SnapshotCount);

        await service.CreateAsync(ArticleRequest(title: "ثاني"), CancellationToken.None);
        var refreshed = await service.GetSnapshotAsync(CancellationToken.None);

        Assert.Equal(2, reader.SnapshotCount);
        Assert.Equal(2, refreshed.Count);
    }

    // ---------- update / delete ----------

    [Fact]
    public async Task Update_MissingId_IsNotFound()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            service.UpdateAsync("ghost", ArticleRequest(), CancellationToken.None));
    }

    [Fact]
    public async Task Update_ChangesType_ClearsStaleFields_AndInvalidatesCache()
    {
        var service = CreateService();
        var created = await service.CreateAsync(new UpsertContentItemRequest
        {
            Type = ContentType.Video,
            Title = "محاضرة",
            CategoryIds = ["aqeedah"],
            VideoId = "abc123",
            VideoProvider = VideoProvider.Youtube,
        }, CancellationToken.None);

        var dto = await service.UpdateAsync(created.Id, ArticleRequest(title: "محاضرة"), CancellationToken.None);

        Assert.Equal(ContentType.Article, dto.Type);
        Assert.Null(dto.VideoId);
        Assert.True(cacheVersion.Current > 1);
    }

    [Fact]
    public async Task Delete_RemovesRowAndBumpsVersion()
    {
        var service = CreateService();
        var created = await service.CreateAsync(ArticleRequest(), CancellationToken.None);

        await service.DeleteAsync(created.Id, CancellationToken.None);

        Assert.Empty(contents.Items);
        Assert.Equal(2, unitOfWork.SaveCount);
    }
}

public sealed class CategoryServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

    private readonly FakeCategoryRepository categories = new();

    private readonly FakeCurrentUser user = new();

    private readonly FakeCacheVersion cacheVersion = new();

    private readonly FakeReadThroughCache cache = new();

    private readonly FakeUnitOfWork unitOfWork = new();

    public CategoryServiceTests() =>
        categories.Store.Add(Category.Create("aqeedah", "العقيدة", null, 1, Now));

    private CategoryService CreateService() => new(
        categories,
        unitOfWork,
        user,
        new FixedClock(Now),
        cache,
        cacheVersion,
        new UpsertCategoryRequestValidator(),
        Options.Create(new ContentCacheOptions()));

    private static UpsertCategoryRequest Request(string id = "fiqh", string name = "الفقه") => new()
    {
        Id = id,
        Name = name,
        SortOrder = 2,
    };

    [Fact]
    public async Task List_ReturnsEveryCategoryWithCounts()
    {
        categories.ContentCount = 7;
        var service = CreateService();

        var all = await service.ListAsync(CancellationToken.None);

        Assert.Single(all);
        Assert.Equal(7, all[0].ContentCount);
    }

    [Fact]
    public async Task Get_UnknownId_IsNotFound()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync("nope", CancellationToken.None));
    }

    [Fact]
    public async Task Create_DuplicateId_IsConflict()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(Request("aqeedah"), CancellationToken.None));
    }

    [Fact]
    public async Task Create_ThenReadBack_SucceedsAndBumpsVersion()
    {
        var service = CreateService();
        var before = cacheVersion.Current;

        var dto = await service.CreateAsync(Request(), CancellationToken.None);

        Assert.Equal("fiqh", dto.Id);
        Assert.Equal("الفقه", dto.Name);
        Assert.True(cacheVersion.Current > before);
        Assert.Equal(1, unitOfWork.SaveCount);
    }

    [Fact]
    public async Task Create_BadIdShape_IsValidationFailure()
    {
        var service = CreateService();

        await Assert.ThrowsAsync<FluentValidation.ValidationException>(() => service.CreateAsync(Request("bad id with spaces"), CancellationToken.None));
    }

    [Fact]
    public async Task Update_ChangingId_IsConflict()
    {
        var service = CreateService();

        var conflict = await Assert.ThrowsAsync<ConflictException>(() =>
            service.UpdateAsync("aqeedah", Request(id: "other"), CancellationToken.None));

        Assert.Contains("cannot be changed", conflict.Message, StringComparison.Ordinal);
        Assert.Equal(0, unitOfWork.SaveCount);
    }

    [Fact]
    public async Task Delete_WithLinkedContent_IsConflict()
    {
        var service = CreateService();
        categories.HasContentResult = true;

        await Assert.ThrowsAsync<ConflictException>(() => service.DeleteAsync("aqeedah", CancellationToken.None));
        Assert.Single(categories.Store);
    }

    [Fact]
    public async Task Delete_EmptyCategory_RemovesAndBumpsVersion()
    {
        var service = CreateService();

        await service.DeleteAsync("aqeedah", CancellationToken.None);

        Assert.Empty(categories.Store);
        Assert.Equal(1, unitOfWork.SaveCount);
    }

    [Fact]
    public async Task Delete_WithoutEditorRole_IsForbidden()
    {
        var viewer = new FakeCurrentUser { CanEditContent = false };
        var service = new CategoryService(
            categories, unitOfWork, viewer, new FixedClock(Now), cache, cacheVersion,
            new UpsertCategoryRequestValidator(), Options.Create(new ContentCacheOptions()));

        await Assert.ThrowsAsync<ForbiddenException>(() => service.DeleteAsync("aqeedah", CancellationToken.None));
    }
}
