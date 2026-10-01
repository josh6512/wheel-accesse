import { useEffect, useId, useRef, useState } from 'react';
import type { SelectedImage } from '../../services/mediaService';

function Preview({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file),
      element = ref.current;
    if (element) element.src = url;
    return () => {
      element?.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return <img ref={ref} alt={`Selected image preview: ${file.name}`} />;
}
export function ImagePicker({
  images,
  onChange,
  limit,
  disabled = false,
}: {
  images: SelectedImage[];
  onChange: (images: SelectedImage[]) => void;
  limit: number;
  disabled?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState('');
  return (
    <fieldset className="image-picker" disabled={disabled}>
      <legend>Images (optional)</legend>
      <label htmlFor={id}>Choose images</label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-describedby={`${id}-help`}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length + images.length > limit) {
            setError(`Choose at most ${limit} images.`);
            return;
          }
          if (
            files.some(
              (file) =>
                !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
                !/\.(jpe?g|png|webp)$/i.test(file.name) ||
                file.size > 5 * 1024 * 1024 ||
                file.size === 0,
            )
          ) {
            setError('Choose JPEG, PNG or WebP images up to 5 MiB each.');
            return;
          }
          setError('');
          onChange([
            ...images,
            ...files.map((file) => ({ id: crypto.randomUUID(), file, altText: '' })),
          ]);
        }}
      />
      <p id={`${id}-help`}>
        Up to {limit} images, 5 MiB each. JPEG, PNG or WebP. Images are public after saving. Avoid
        faces and private information. Camera metadata is removed. Selection does not upload.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="image-previews">
        {images.map((image, index) => (
          <div key={image.id} className="image-preview">
            <Preview file={image.file} />
            <label>
              Image {index + 1} description (optional)
              <input
                maxLength={500}
                value={image.altText}
                onChange={(event) =>
                  onChange(
                    images.map((item) =>
                      item.id === image.id ? { ...item, altText: event.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(images.filter((item) => item.id !== image.id))}
            >
              Remove selected image {index + 1}
            </button>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
