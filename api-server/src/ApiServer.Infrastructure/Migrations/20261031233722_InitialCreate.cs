using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ApiServer.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "library");

            migrationBuilder.CreateTable(
                name: "categories",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false, collation: "ar-x-icu"),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false, collation: "ar-x-icu"),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp(3) with time zone", precision: 3, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp(3) with time zone", precision: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "content_items",
                schema: "library",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Tags = table.Column<string>(type: "text", nullable: false),
                    References = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<short>(type: "smallint", nullable: false),
                    Slug = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false, collation: "ar-x-icu"),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false, collation: "ar-x-icu"),
                    ThumbnailUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    AuthorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true, collation: "ar-x-icu"),
                    SourceUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Body = table.Column<string>(type: "text", nullable: true),
                    Featured = table.Column<bool>(type: "boolean", nullable: false),
                    Verified = table.Column<bool>(type: "boolean", nullable: false),
                    Demo = table.Column<bool>(type: "boolean", nullable: false),
                    RightsStatus = table.Column<short>(type: "smallint", nullable: false),
                    PublishedAt = table.Column<DateTimeOffset>(type: "timestamp(3) with time zone", precision: 3, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp(3) with time zone", precision: 3, nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp(3) with time zone", precision: 3, nullable: false),
                    VideoId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    VideoProvider = table.Column<short>(type: "smallint", nullable: true),
                    DurationSeconds = table.Column<int>(type: "integer", nullable: true),
                    SeriesName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true, collation: "ar-x-icu"),
                    CoverUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Publisher = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Isbn = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    PublicationYear = table.Column<int>(type: "integer", nullable: true),
                    Availability = table.Column<short>(type: "smallint", nullable: true),
                    ReadingTimeMinutes = table.Column<int>(type: "integer", nullable: true),
                    DocumentUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    DocumentFormat = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    AuthorizedLinks = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_content_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "content_item_categories",
                schema: "library",
                columns: table => new
                {
                    CategoriesId = table.Column<string>(type: "character varying(100)", nullable: false),
                    ContentItemsId = table.Column<string>(type: "character varying(100)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_content_item_categories", x => new { x.CategoriesId, x.ContentItemsId });
                    table.ForeignKey(
                        name: "FK_content_item_categories_categories_CategoriesId",
                        column: x => x.CategoriesId,
                        principalSchema: "library",
                        principalTable: "categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_content_item_categories_content_items_ContentItemsId",
                        column: x => x.ContentItemsId,
                        principalSchema: "library",
                        principalTable: "content_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_categories_SortOrder_Name",
                schema: "library",
                table: "categories",
                columns: new[] { "SortOrder", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_content_item_categories_ContentItemsId",
                schema: "library",
                table: "content_item_categories",
                column: "ContentItemsId");

            migrationBuilder.CreateIndex(
                name: "IX_content_items_Featured",
                schema: "library",
                table: "content_items",
                column: "Featured");

            migrationBuilder.CreateIndex(
                name: "IX_content_items_PublishedAt",
                schema: "library",
                table: "content_items",
                column: "PublishedAt");

            migrationBuilder.CreateIndex(
                name: "IX_content_items_SeriesName",
                schema: "library",
                table: "content_items",
                column: "SeriesName");

            migrationBuilder.CreateIndex(
                name: "IX_content_items_Type_PublishedAt",
                schema: "library",
                table: "content_items",
                columns: new[] { "Type", "PublishedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_content_items_Type_Slug",
                schema: "library",
                table: "content_items",
                columns: new[] { "Type", "Slug" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "content_item_categories",
                schema: "library");

            migrationBuilder.DropTable(
                name: "categories",
                schema: "library");

            migrationBuilder.DropTable(
                name: "content_items",
                schema: "library");
        }
    }
}
