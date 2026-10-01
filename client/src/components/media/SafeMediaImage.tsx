import { useState } from 'react';

export function SafeMediaImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="image-unavailable" role="img" aria-label={`${alt} — image unavailable`}>
      Image unavailable
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
