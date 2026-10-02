export function AreaHeading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="shopHeading">
      <h1>{title}</h1>
      <p>{blurb}</p>
    </div>
  );
}
