import { useId } from 'react';
import type { CategoryFeature } from '../../types/api';
export function AccessibilityFields({
  features,
  values,
  onChange,
}: {
  features: CategoryFeature[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  const prefix = useId();
  return (
    <fieldset className="accessibility-fields">
      <legend>Accessibility observations (optional)</legend>
      <p>Answer only what you know. Leaving an answer blank means unknown, not “No”.</p>
      {features.map((feature) => {
        const id = `${prefix}-${feature.id}`;
        const common = {
          id,
          value: values[feature.id] ?? '',
          onChange: (
            event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
          ) => onChange(feature.id, event.target.value),
          'aria-describedby': feature.description ? `${id}-help` : undefined,
        };
        return (
          <div className="write-field" key={feature.id}>
            <label htmlFor={id}>
              {feature.displayName}
              {feature.unit ? ` (${feature.unit})` : ''}
            </label>
            {feature.valueType === 'boolean' ? (
              <select {...common}>
                <option value="">Not sure / skip</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : feature.valueType === 'numeric' ? (
              <input
                {...common}
                type="number"
                step="0.0001"
                min={-99999999999999}
                max={99999999999999}
              />
            ) : feature.valueType === 'select' ? (
              <select {...common}>
                <option value="">Not sure / skip</option>
                {feature.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.displayName}
                  </option>
                ))}
              </select>
            ) : feature.valueType === 'text' ? (
              <textarea {...common} maxLength={2000} rows={2} />
            ) : (
              <p>This observation type is not supported yet.</p>
            )}
            {feature.description && <small id={`${id}-help`}>{feature.description}</small>}
          </div>
        );
      })}
    </fieldset>
  );
}
