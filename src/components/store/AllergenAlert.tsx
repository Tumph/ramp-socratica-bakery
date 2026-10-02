export function AllergenAlert({ body }: { body: string }) {
  return (
    <aside className="shopAllergens">
      <p className="shopAllergensTitle">Potential Allergens</p>
      <p className="shopAllergensBody">{body}</p>
    </aside>
  );
}
