using ApiServer.Application.Contracts.Categories;
using ApiServer.Application.Contracts.Content;
using ApiServer.Domain.Common;
using ApiServer.Domain.Entities;
using FluentValidation;

namespace ApiServer.Application.Validation;

/// <summary>
/// Shape checks on inbound data, so a malformed request fails with a field-level 400 before
/// touching the database. These are deliberately no stricter than the domain rules they
/// precede: <see cref="ContentItem"/> stays the single authority on what a valid record is.
/// </summary>
public sealed class UpsertContentItemRequestValidator : AbstractValidator<UpsertContentItemRequest>
{
    public UpsertContentItemRequestValidator()
    {
        RuleFor(item => item.Title).MustBeNonBlank().MaximumLength(ContentItem.TitleMaxLength);

        RuleFor(item => item.Slug).MaximumLength(Slugs.MaxLength);

        RuleFor(item => item.Description).MaximumLength(ContentItem.DescriptionMaxLength);

        RuleFor(item => item.Body).MaximumLength(ContentItem.BodyMaxLength);

        RuleFor(item => item.RightsStatus).IsInEnum();

        RuleFor(item => item.Type).IsInEnum();

        RuleFor(item => item.VideoProvider).IsInEnum().When(item => item.VideoProvider.HasValue);

        RuleFor(item => item.Availability).IsInEnum().When(item => item.Availability.HasValue);

        RuleFor(item => item.DurationSeconds)
            .InclusiveBetween(0, ContentItem.MaxDurationSeconds)
            .When(item => item.DurationSeconds.HasValue);

        RuleFor(item => item.Tags)
            .Must(tags => tags is null || tags.Count <= ContentItem.MaxTags)
            .WithMessage($"At most {ContentItem.MaxTags} tags are allowed.");

        RuleFor(item => item.References)
            .Must(references => references is null || references.Count <= ContentItem.MaxReferences)
            .WithMessage($"At most {ContentItem.MaxReferences} references are allowed.");

        RuleFor(item => item.AuthorizedLinks)
            .Must(links => links is null || links.Count <= ContentItem.MaxAuthorizedLinks)
            .WithMessage($"At most {ContentItem.MaxAuthorizedLinks} authorised links are allowed.");

        // Content with no category cannot be browsed, so it is rejected at the door.
        RuleFor(item => item.CategoryIds)
            .Must(categories => categories is { Count: > 0 })
            .WithMessage("Select at least one category.");

        RuleForEach(item => item.CategoryIds).MustBeNonBlank();
        RuleForEach(item => item.Tags).MustBeNonBlank();
        RuleForEach(item => item.References).MaximumLength(500);

        RuleForEach(item => item.AuthorizedLinks).ChildRules(link =>
        {
            link.RuleFor(entry => entry.Label).MustBeNonBlank();
            link.RuleFor(entry => entry.Url).MustBeNonBlank();
        });
    }
}

public sealed class UpsertCategoryRequestValidator : AbstractValidator<UpsertCategoryRequest>
{
    public UpsertCategoryRequestValidator()
    {
        RuleFor(category => category.Id)
            .MustBeNonBlank()
            .MaximumLength(Category.IdMaxLength)
            .Matches(@"^[\p{L}\p{Nd}][\p{L}\p{Nd}._-]*$")
            .WithMessage("Category id may contain letters, digits, dots, hyphens and underscores only.");

        RuleFor(category => category.Name).MustBeNonBlank().MaximumLength(Category.NameMaxLength);

        RuleFor(category => category.Description).MaximumLength(Category.DescriptionMaxLength);
    }
}

public sealed class ContentQueryValidator : AbstractValidator<ContentQuery>
{
    public ContentQueryValidator()
    {
        // Paging needs no rules: ContentQuery.Normalize clamps page and size, so an
        // oversized request gets a full page back rather than an error. Search length is
        // different — it is an input the caller should shorten, not a bound we can honour.
        RuleFor(query => query.Search).MaximumLength(ContentQuery.MaxSearchLength);
    }
}

internal static class RuleBuilderExtensions
{
    /// <summary>Rejects null, empty and whitespace-only strings with one shared message.</summary>
    public static IRuleBuilderOptions<T, string?> MustBeNonBlank<T>(this IRuleBuilder<T, string?> ruleBuilder) =>
        ruleBuilder
            .NotEmpty().WithMessage("A value is required.")
            .Must(static value => !string.IsNullOrWhiteSpace(value)).WithMessage("A value is required.");
}
