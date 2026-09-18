BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [display_name] NVARCHAR(100),
    [email] NVARCHAR(254),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [users_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[mobility_types] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [display_name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [mobility_types_is_active_df] DEFAULT 1,
    [display_order] INT NOT NULL CONSTRAINT [mobility_types_display_order_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [mobility_types_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [mobility_types_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [mobility_types_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[user_mobility_types] (
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [mobility_type_id] UNIQUEIDENTIFIER NOT NULL,
    [is_primary] BIT NOT NULL CONSTRAINT [user_mobility_types_is_primary_df] DEFAULT 0,
    [show_publicly_with_reviews] BIT NOT NULL CONSTRAINT [user_mobility_types_show_publicly_with_reviews_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [user_mobility_types_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [user_mobility_types_pkey] PRIMARY KEY CLUSTERED ([user_id],[mobility_type_id])
);

-- CreateTable
CREATE TABLE [dbo].[categories] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [display_name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(1000),
    [is_active] BIT NOT NULL CONSTRAINT [categories_is_active_df] DEFAULT 1,
    [display_order] INT NOT NULL CONSTRAINT [categories_display_order_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [categories_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [categories_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [categories_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[places] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [category_id] UNIQUEIDENTIFIER NOT NULL,
    [address] NVARCHAR(500),
    [city] NVARCHAR(120),
    [region] NVARCHAR(120),
    [country_code] NVARCHAR(2),
    [latitude] DECIMAL(9,6),
    [longitude] DECIMAL(9,6),
    [created_by_id] UNIQUEIDENTIFIER,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [places_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [places_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[accessibility_features] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [display_name] NVARCHAR(120) NOT NULL,
    [description] NVARCHAR(1000),
    [value_type] NVARCHAR(16) NOT NULL,
    [unit] NVARCHAR(32),
    [is_active] BIT NOT NULL CONSTRAINT [accessibility_features_is_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [accessibility_features_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [accessibility_features_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [accessibility_features_code_key] UNIQUE NONCLUSTERED ([code]),
    CONSTRAINT [accessibility_features_id_value_type_key] UNIQUE NONCLUSTERED ([id],[value_type])
);

-- CreateTable
CREATE TABLE [dbo].[accessibility_feature_options] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [feature_id] UNIQUEIDENTIFIER NOT NULL,
    [code] NVARCHAR(64) NOT NULL,
    [display_name] NVARCHAR(120) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [accessibility_feature_options_is_active_df] DEFAULT 1,
    [display_order] INT NOT NULL CONSTRAINT [accessibility_feature_options_display_order_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [accessibility_feature_options_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [accessibility_feature_options_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [accessibility_feature_options_feature_id_code_key] UNIQUE NONCLUSTERED ([feature_id],[code]),
    CONSTRAINT [accessibility_feature_options_id_feature_id_key] UNIQUE NONCLUSTERED ([id],[feature_id])
);

-- CreateTable
CREATE TABLE [dbo].[category_features] (
    [category_id] UNIQUEIDENTIFIER NOT NULL,
    [feature_id] UNIQUEIDENTIFIER NOT NULL,
    [display_order] INT NOT NULL CONSTRAINT [category_features_display_order_df] DEFAULT 0,
    [is_active] BIT NOT NULL CONSTRAINT [category_features_is_active_df] DEFAULT 1,
    [is_primary] BIT NOT NULL CONSTRAINT [category_features_is_primary_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [category_features_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [category_features_pkey] PRIMARY KEY CLUSTERED ([category_id],[feature_id])
);

-- CreateTable
CREATE TABLE [dbo].[place_accessibility_reports] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [place_id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] UNIQUEIDENTIFIER,
    [observed_at] DATETIME2,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [place_accessibility_reports_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [place_accessibility_reports_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[place_accessibility_answers] (
    [report_id] UNIQUEIDENTIFIER NOT NULL,
    [feature_id] UNIQUEIDENTIFIER NOT NULL,
    [value_type] NVARCHAR(16) NOT NULL,
    [boolean_value] BIT,
    [numeric_value] DECIMAL(18,4),
    [numeric_unit] NVARCHAR(32),
    [text_value] NVARCHAR(2000),
    [option_id] UNIQUEIDENTIFIER,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [place_accessibility_answers_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [place_accessibility_answers_pkey] PRIMARY KEY CLUSTERED ([report_id],[feature_id])
);

-- CreateTable
CREATE TABLE [dbo].[reviews] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [place_id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] UNIQUEIDENTIFIER,
    [body] NVARCHAR(4000) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [reviews_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [reviews_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[media_assets] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [storage_key] NVARCHAR(400) NOT NULL,
    [mime_type] NVARCHAR(100) NOT NULL,
    [uploader_id] UNIQUEIDENTIFIER,
    [alt_text] NVARCHAR(1000),
    [created_at] DATETIME2 NOT NULL CONSTRAINT [media_assets_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    [deleted_at] DATETIME2,
    CONSTRAINT [media_assets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [media_assets_storage_key_key] UNIQUE NONCLUSTERED ([storage_key])
);

-- CreateTable
CREATE TABLE [dbo].[place_media] (
    [place_id] UNIQUEIDENTIFIER NOT NULL,
    [media_asset_id] UNIQUEIDENTIFIER NOT NULL,
    [display_order] INT NOT NULL CONSTRAINT [place_media_display_order_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [place_media_created_at_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [place_media_pkey] PRIMARY KEY CLUSTERED ([place_id],[media_asset_id])
);

-- CreateTable
CREATE TABLE [dbo].[review_media] (
    [review_id] UNIQUEIDENTIFIER NOT NULL,
    [media_asset_id] UNIQUEIDENTIFIER NOT NULL,
    [display_order] INT NOT NULL CONSTRAINT [review_media_display_order_df] DEFAULT 0,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [review_media_created_at_df] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [review_media_pkey] PRIMARY KEY CLUSTERED ([review_id],[media_asset_id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [users_email_idx] ON [dbo].[users]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [user_mobility_types_mobility_type_id_idx] ON [dbo].[user_mobility_types]([mobility_type_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [places_category_id_deleted_at_idx] ON [dbo].[places]([category_id], [deleted_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [places_city_idx] ON [dbo].[places]([city]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [places_country_code_city_idx] ON [dbo].[places]([country_code], [city]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [places_name_idx] ON [dbo].[places]([name]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [places_created_by_id_idx] ON [dbo].[places]([created_by_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [category_features_feature_id_idx] ON [dbo].[category_features]([feature_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [place_accessibility_reports_place_id_deleted_at_created_at_idx] ON [dbo].[place_accessibility_reports]([place_id], [deleted_at], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [place_accessibility_reports_user_id_idx] ON [dbo].[place_accessibility_reports]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [place_accessibility_answers_feature_id_value_type_idx] ON [dbo].[place_accessibility_answers]([feature_id], [value_type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [place_accessibility_answers_option_id_feature_id_idx] ON [dbo].[place_accessibility_answers]([option_id], [feature_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reviews_place_id_deleted_at_created_at_idx] ON [dbo].[reviews]([place_id], [deleted_at], [created_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [reviews_user_id_idx] ON [dbo].[reviews]([user_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [media_assets_uploader_id_idx] ON [dbo].[media_assets]([uploader_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [place_media_media_asset_id_idx] ON [dbo].[place_media]([media_asset_id]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [review_media_media_asset_id_idx] ON [dbo].[review_media]([media_asset_id]);

-- AddForeignKey
ALTER TABLE [dbo].[user_mobility_types] ADD CONSTRAINT [user_mobility_types_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_mobility_types] ADD CONSTRAINT [user_mobility_types_mobility_type_id_fkey] FOREIGN KEY ([mobility_type_id]) REFERENCES [dbo].[mobility_types]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[places] ADD CONSTRAINT [places_category_id_fkey] FOREIGN KEY ([category_id]) REFERENCES [dbo].[categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[places] ADD CONSTRAINT [places_created_by_id_fkey] FOREIGN KEY ([created_by_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[accessibility_feature_options] ADD CONSTRAINT [accessibility_feature_options_feature_id_fkey] FOREIGN KEY ([feature_id]) REFERENCES [dbo].[accessibility_features]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[category_features] ADD CONSTRAINT [category_features_category_id_fkey] FOREIGN KEY ([category_id]) REFERENCES [dbo].[categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[category_features] ADD CONSTRAINT [category_features_feature_id_fkey] FOREIGN KEY ([feature_id]) REFERENCES [dbo].[accessibility_features]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[place_accessibility_reports] ADD CONSTRAINT [place_accessibility_reports_place_id_fkey] FOREIGN KEY ([place_id]) REFERENCES [dbo].[places]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[place_accessibility_reports] ADD CONSTRAINT [place_accessibility_reports_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[place_accessibility_answers] ADD CONSTRAINT [place_accessibility_answers_report_id_fkey] FOREIGN KEY ([report_id]) REFERENCES [dbo].[place_accessibility_reports]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[place_accessibility_answers] ADD CONSTRAINT [place_accessibility_answers_feature_id_value_type_fkey] FOREIGN KEY ([feature_id], [value_type]) REFERENCES [dbo].[accessibility_features]([id],[value_type]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[place_accessibility_answers] ADD CONSTRAINT [place_accessibility_answers_option_id_feature_id_fkey] FOREIGN KEY ([option_id], [feature_id]) REFERENCES [dbo].[accessibility_feature_options]([id],[feature_id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [reviews_place_id_fkey] FOREIGN KEY ([place_id]) REFERENCES [dbo].[places]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[reviews] ADD CONSTRAINT [reviews_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[media_assets] ADD CONSTRAINT [media_assets_uploader_id_fkey] FOREIGN KEY ([uploader_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[place_media] ADD CONSTRAINT [place_media_place_id_fkey] FOREIGN KEY ([place_id]) REFERENCES [dbo].[places]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[place_media] ADD CONSTRAINT [place_media_media_asset_id_fkey] FOREIGN KEY ([media_asset_id]) REFERENCES [dbo].[media_assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[review_media] ADD CONSTRAINT [review_media_review_id_fkey] FOREIGN KEY ([review_id]) REFERENCES [dbo].[reviews]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[review_media] ADD CONSTRAINT [review_media_media_asset_id_fkey] FOREIGN KEY ([media_asset_id]) REFERENCES [dbo].[media_assets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Supplemental SQL Server integrity rules from prisma/constraints.sql.
-- These remain inside Prisma's generated transaction so a failure rolls back the full schema.

CREATE UNIQUE INDEX [user_mobility_types_one_primary_per_user]
ON [dbo].[user_mobility_types] ([user_id])
WHERE [is_primary] = 1;

ALTER TABLE [dbo].[accessibility_features]
ADD CONSTRAINT [accessibility_features_value_type_check]
CHECK ([value_type] IN (N'boolean', N'numeric', N'text', N'select'));

ALTER TABLE [dbo].[accessibility_features]
ADD CONSTRAINT [accessibility_features_unit_check]
CHECK ([unit] IS NULL OR ([value_type] = N'numeric' AND LEN(LTRIM(RTRIM([unit]))) > 0));

ALTER TABLE [dbo].[place_accessibility_answers]
ADD CONSTRAINT [place_accessibility_answers_typed_value_check]
CHECK (
    ([value_type] = N'boolean' AND [boolean_value] IS NOT NULL
        AND [numeric_value] IS NULL AND [numeric_unit] IS NULL
        AND [text_value] IS NULL AND [option_id] IS NULL)
 OR ([value_type] = N'numeric' AND [numeric_value] IS NOT NULL
        AND [boolean_value] IS NULL AND [text_value] IS NULL AND [option_id] IS NULL
        AND ([numeric_unit] IS NULL OR LEN(LTRIM(RTRIM([numeric_unit]))) > 0))
 OR ([value_type] = N'text' AND [text_value] IS NOT NULL
        AND LEN(LTRIM(RTRIM([text_value]))) > 0 AND [boolean_value] IS NULL
        AND [numeric_value] IS NULL AND [numeric_unit] IS NULL AND [option_id] IS NULL)
 OR ([value_type] = N'select' AND [option_id] IS NOT NULL
        AND [boolean_value] IS NULL AND [numeric_value] IS NULL
        AND [numeric_unit] IS NULL AND [text_value] IS NULL)
);

ALTER TABLE [dbo].[places]
ADD CONSTRAINT [places_coordinates_check]
CHECK (
    ([latitude] IS NULL AND [longitude] IS NULL)
 OR ([latitude] IS NOT NULL AND [longitude] IS NOT NULL
        AND [latitude] BETWEEN -90 AND 90 AND [longitude] BETWEEN -180 AND 180)
);

ALTER TABLE [dbo].[reviews]
ADD CONSTRAINT [reviews_body_check]
CHECK (LEN(LTRIM(RTRIM([body]))) > 0);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
