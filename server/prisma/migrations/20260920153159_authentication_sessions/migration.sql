SET XACT_ABORT ON;
BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[user_credentials] (
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [normalized_email] NVARCHAR(254) COLLATE Latin1_General_100_BIN2 NOT NULL,
    [password_hash] NVARCHAR(512) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [user_credentials_created_at_df] DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NOT NULL,
    CONSTRAINT [user_credentials_pkey] PRIMARY KEY CLUSTERED ([user_id]),
    CONSTRAINT [user_credentials_normalized_email_key] UNIQUE NONCLUSTERED ([normalized_email])
);

-- CreateTable
CREATE TABLE [dbo].[refresh_sessions] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [family_id] UNIQUEIDENTIFIER NOT NULL,
    [token_hash] CHAR(64) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [refresh_sessions_created_at_df] DEFAULT SYSUTCDATETIME(),
    [expires_at] DATETIME2 NOT NULL,
    [revoked_at] DATETIME2,
    [replaced_by_id] UNIQUEIDENTIFIER,
    CONSTRAINT [refresh_sessions_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [refresh_sessions_family_id_revoked_at_idx] ON [dbo].[refresh_sessions]([family_id], [revoked_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [refresh_sessions_user_id_revoked_at_idx] ON [dbo].[refresh_sessions]([user_id], [revoked_at]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [refresh_sessions_expires_at_idx] ON [dbo].[refresh_sessions]([expires_at]);

-- AddForeignKey
ALTER TABLE [dbo].[user_credentials] ADD CONSTRAINT [user_credentials_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[refresh_sessions] ADD CONSTRAINT [refresh_sessions_user_id_fkey] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
