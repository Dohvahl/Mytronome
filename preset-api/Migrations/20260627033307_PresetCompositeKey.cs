using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace preset_api.Migrations
{
    /// <inheritdoc />
    public partial class PresetCompositeKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Presets",
                table: "Presets");

            migrationBuilder.DropIndex(
                name: "IX_Presets_OwnerId",
                table: "Presets");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Presets",
                table: "Presets",
                columns: new[] { "OwnerId", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Presets",
                table: "Presets");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Presets",
                table: "Presets",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_Presets_OwnerId",
                table: "Presets",
                column: "OwnerId");
        }
    }
}
