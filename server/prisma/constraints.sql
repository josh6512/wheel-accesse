-- SQL Server integrity rules not expressible in this Prisma schema.
-- Insert before COMMIT TRAN in the initial create-only migration BEFORE applying it.
-- This file is NOT an applied migration. See docs/database-schema.md.

CREATE UNIQUE INDEX [user_mobility_types_one_primary_per_user]
ON [dbo].[user_mobility_types] ([user_id])
WHERE [is_primary] = 1;

ALTER TABLE [dbo].[accessibility_features]
ADD CONSTRAINT [accessibility_features_value_type_check]
CHECK ([value_type] IN (N'boolean', N'numeric', N'text', N'select'));

ALTER TABLE [dbo].[accessibility_features]
ADD CONSTRAINT [accessibility_features_unit_check]
CHECK ([unit] IS NULL OR ([value_type] = N'numeric' AND LEN(LTRIM(RTRIM([unit]))) > 0));

-- The feature FK binds value_type to the catalog. This CHECK makes exactly the
-- matching value non-null. BIT false and DECIMAL zero are valid observations.
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
