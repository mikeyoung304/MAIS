interface StarRatingProps {
  rating: number;
  className?: string;
}

export function StarRating({ rating, className = '' }: StarRatingProps) {
  return (
    <div className={`flex gap-1 text-sage ${className}`}>
      {[...Array(5)].map((_, i) => (
        <span key={i} className={i < rating ? 'opacity-100' : 'opacity-30'}>
          &#9733;
        </span>
      ))}
    </div>
  );
}
