SET XACT_ABORT ON;
BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[content_reports] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [reporter_user_id] UNIQUEIDENTIFIER NOT NULL,
    [target_type] NVARCHAR(32) NOT NULL,
    [target_id] UNIQUEIDENTIFIER NOT NULL,
    [reason] NVARCHAR(40) NOT NULL,
    [details] NVARCHAR(1000),
    [status] NVARCHAR(24) NOT NULL CONSTRAINT [content_reports_status_df] DEFAULT 'OPEN',
    [created_at] DATETIME2 NOT NULL CONSTRAINT [content_reports_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [content_reports_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [content_reports_reporter_user_id_target_type_target_id_reason_key] UNIQUE NONCLUSTERED ([reporter_user_id],[target_type],[target_id],[reason])
);

-- Keep stored domains canonical even if a future writer bypasses the API.
ALTER TABLE [dbo].[content_reports] ADD CONSTRAINT [content_reports_target_type_chk]
CHECK ([target_type] COLLATE Latin1_General_100_BIN2 IN ('PLACE', 'REVIEW', 'PLACE_MEDIA', 'REVIEW_MEDIA'));

ALTER TABLE [dbo].[content_reports] ADD CONSTRAINT [content_reports_reason_chk]
CHECK ([reason] COLLATE Latin1_General_100_BIN2 IN (
    'INCORRECT_INFORMATION', 'SPAM', 'ABUSIVE_OR_HARASSING',
    'INAPPROPRIATE_MEDIA', 'DUPLICATE', 'OTHER'
));

ALTER TABLE [dbo].[content_reports] ADD CONSTRAINT [content_reports_status_chk]
CHECK ([status] COLLATE Latin1_General_100_BIN2 IN ('OPEN'));

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_target_type_target_id_status_idx] ON [dbo].[content_reports]([target_type], [target_id], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [content_reports_status_created_at_idx] ON [dbo].[content_reports]([status], [created_at]);

-- AddForeignKey
ALTER TABLE [dbo].[content_reports] ADD CONSTRAINT [content_reports_reporter_user_id_fkey] FOREIGN KEY ([reporter_user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
