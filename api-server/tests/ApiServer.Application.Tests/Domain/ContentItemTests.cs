using ApiServer.Domain.Common;
using ApiServer.Domain.Entities;
using ApiServer.Domain.Enums;
using ApiServer.Domain.ValueObjects;

namespace ApiServer.Application.Tests.Domain;

/// <summary>
/// The domain's promise: an instance cannot exist in an invalid state. These tests hit the
/// aggregate directly — no services, no fakes — because these are the rules everything else trusts.
/// </summary>
public sealed class ContentItemTests
{
    private static readonly DateTimeOffset Now = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

    public static Category KnownCategory(string id = "aqeedah") =>
        Category.Create(id, "العقيدة", null, 1, Now);

    private static ContentItemDraft Draft(
        ContentType type = ContentType.Article,
        string? title = "Test Record",
        string? slug = null,
        string? body = "Some stored text",
        string? sourceUrl = null,
        RightsStatus rights = RightsStatus.Owned) => new()
    {
        Type = type,
        Title = title,
        Slug = slug,
        Body = body,
        SourceUrl = sourceUrl,
        RightsStatus = rights,
    };

    // ---------- required shape ----------

    [Fact]
    public void Create_WithBlankTitle_Throws()
    {
        Assert.Throws<DomainException>(() => ContentItem.Create(id: null, Draft(title: "   "), Now));
    }

    [Fact]
    public void Create_FromArabicTitle_ProducesReadableIdAndSlug()
    {
        var item = ContentItem.Create(id: null, Draft(title: "شرح العقيدة"), Now);

        Assert.Equal("شرح-العقيدة", item.Slug);
        Assert.StartsWith("شرح-العقيدة-", item.Id, StringComparison.Ordinal);
    }

    [Fact]
    public void Create_WithoutSlugDerivesItFromTitle_AndTrimsExplicitSlug()
    {
        var derived = ContentItem.Create(id: null, Draft(slug: null, title: "  My Study  "), Now);
        var explicitSlug = ContentItem.Create(id: null, Draft(slug: "  Given-Slug  ", title: "My Study"), Now);

        Assert.Equal("my-study", derived.Slug);
        Assert.Equal("given-slug", explicitSlug.Slug);
    }

    // ---------- type-specific invariants ----------

    [Fact]
    public void Video_WithVideoIdButNoProvider_Throws()
    {
        var draft = Draft(ContentType.Video, body: null) with
        {
            VideoId = "dQw4w9WgXcQ",
        };

        Assert.Throws<DomainException>(() => ContentItem.Create(id: null, draft, Now));
    }

    [Fact]
    public void Book_WithMalformedIsbn_Throws()
    {
        var draft = Draft(ContentType.Book) with { Isbn = "978-xx-12" };

        Assert.Throws<DomainException>(() => ContentItem.Create(id: null, draft, Now));
    }

    [Fact]
    public void Book_NormalizesIsbnAndUpperCasesCheckDigit()
    {
        var item = ContentItem.Create(id: null, Draft(ContentType.Book) with { Isbn = "978 3 16 148410 0" }, Now);

        Assert.Equal("9783161484100", item.Isbn);
    }

    [Fact]
    public void Article_WithNoBodyAndNoSourceUrl_Throws()
    {
        // Mirrors the frontend: bodyless articles must link out; there would be nothing to read.
        var draft = Draft(ContentType.Article, body: null, sourceUrl: null);

        Assert.Throws<DomainException>(() => ContentItem.Create(id: null, draft, Now));
    }

    [Fact]
    public void Research_WithNoTextDocumentOrSource_Throws()
    {
        var draft = Draft(ContentType.Research, body: null);

        Assert.Throws<DomainException>(() => ContentItem.Create(id: null, draft, Now));
    }

    [Fact]
    public void ExternalRights_WithoutSourceUrl_Throws()
    {
        var draft = Draft(rights: RightsStatus.External, sourceUrl: null);

        Assert.Throws<DomainException>(() => ContentItem.Create(id: null, draft, Now));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(ContentItem.MaxDurationSeconds + 1)]
    public void Video_DurationOutOfRange_Throws(int duration)
    {
        var draft = Draft(ContentType.Video, body: null) with { DurationSeconds = duration };

        Assert.Throws<DomainException>(() => ContentItem.Create(id: null, draft, Now));
    }

    // ---------- full-replacement semantics ----------

    [Fact]
    public void Update_ChangingType_ClearsOldTypeFields()
    {
        var video = ContentItem.Create(id: null, Draft(ContentType.Video, body: null) with
        {
            VideoId = "abc",
            VideoProvider = VideoProvider.Youtube,
            SeriesName = "Dars",
        }, Now);

        video.Update(Draft(ContentType.Book), Now);

        Assert.Null(video.VideoId);
        Assert.Null(video.VideoProvider);
        Assert.Null(video.SeriesName);
        Assert.Equal(ContentType.Book, video.Type);
    }

    [Fact]
    public void Update_RejectedDraft_LeavesPreviousStateIntact()
    {
        var item = ContentItem.Create(id: null, Draft(title: "Original"), Now);

        // Validate() runs before any assignment, so a cross-field violation cannot
        // leave the tracked entity half-rewritten.
        var bad = Draft(ContentType.Video) with { VideoId = "abc", VideoProvider = null };
        Assert.Throws<DomainException>(() => item.Update(bad, Now));

        Assert.Equal("Original", item.Title);
        Assert.Equal(ContentType.Article, item.Type);
        Assert.Equal("Some stored text", item.Body);
    }

    // ---------- collections ----------

    [Fact]
    public void AssignCategories_Empty_Throws()
    {
        var item = ContentItem.Create(id: null, Draft(), Now);

        Assert.Throws<DomainException>(() => item.AssignCategories([]));
    }

    [Fact]
    public void AssignCategories_DuplicateId_Throws()
    {
        var item = ContentItem.Create(id: null, Draft(), Now);

        Assert.Throws<DomainException>(() => item.AssignCategories([KnownCategory("aql"), KnownCategory("aql")]));
    }

    [Fact]
    public void Tags_AreDeduplicatedAndCapped()
    {
        var item = ContentItem.Create(id: null, Draft() with { Tags = ["radd", "radd", "iman"] }, Now);

        Assert.Equal(2, item.Tags.Count);

        Assert.Throws<DomainException>(() =>
            ContentItem.Create(id: null, Draft() with { Tags = Enumerable.Range(0, ContentItem.MaxTags + 1).Select(static i => $"t{i}").ToArray() }, Now));
    }

    // ---------- timestamps ----------

    [Fact]
    public void PublishedAt_IsStoredInUtc()
    {
        var item = ContentItem.Create(id: null, Draft() with { PublishedAt = new DateTimeOffset(2026, 5, 1, 9, 0, 0, TimeSpan.FromHours(3)) }, Now);

        Assert.Equal(TimeSpan.Zero, item.PublishedAt!.Value.Offset);
        Assert.Equal(6, item.PublishedAt!.Value.Hour);
    }

    [Fact]
    public void CreatedAt_StaysFixedWhileUpdatedAt_Advances()
    {
        var item = ContentItem.Create(id: null, Draft(), Now);
        var later = Now.AddHours(5);

        item.Update(Draft(title: "Renamed"), later);

        Assert.Equal(Now, item.CreatedAt);
        Assert.Equal(later, item.UpdatedAt);
    }
}

public sealed class CategoryTests
{
    private static readonly DateTimeOffset Now = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Create_TrimsAndStampsTimestamps()
    {
        var category = Category.Create("  aqeedah  ", " العقيدة ", null, 2, Now);

        Assert.Equal("aqeedah", category.Id);
        Assert.Equal("العقيدة", category.Name);
        Assert.Equal(Now, category.CreatedAt);
    }

    [Fact]
    public void Create_BlankName_Throws() =>
        Assert.Throws<DomainException>(() => Category.Create("x", "   ", null, 0, Now));

    [Fact]
    public void Update_KeepsCreatedAt()
    {
        var category = Category.Create("x", "Old", null, 0, Now);

        category.Update("New", null, 3, Now.AddMinutes(30));

        Assert.Equal(Now, category.CreatedAt);
        Assert.Equal(Now.AddMinutes(30), category.UpdatedAt);
        Assert.Equal("New", category.Name);
    }
}
