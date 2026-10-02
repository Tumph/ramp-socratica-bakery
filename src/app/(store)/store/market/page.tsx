import Link from "next/link";
import { StoreHeader } from "@/components/store/StoreHeader";

/** The three market areas. Names and copy come from the design. */
const AREAS = [
  { id: "aisle", name: "Aisle", blurb: "Non-perishables & essentials" },
  { id: "fruits", name: "Fruits", blurb: "Fresh tasty berries & assorted produce" },
  { id: "fridge", name: "Fridge", blurb: "Anything that needs cold temps" },
];

export default function MarketPage() {
  return (
    <div className="storePage">
      <StoreHeader />

      <main className="storeMain">
        <section className="storeIntro">
          <h1 className="storeHeading">Welcome to the Market</h1>
          <p className="storeBody">
            Explore different areas to grab ingredients. Be sure to take a look at everything!
          </p>
        </section>

        <nav className="storeAreas" aria-label="Market areas">
          {AREAS.map((area) => (
            <Link key={area.id} href={`/store/market/${area.id}`} className="storeArea">
              <span className="storeAreaHead">
                <span className="storeAreaName">{area.name}</span>
                <img className="storeCaret" src="/store/caret-right.svg" alt="" aria-hidden />
              </span>
              <span className="storeAreaBlurb">{area.blurb}</span>
            </Link>
          ))}
        </nav>

        <div className="storeScene">
          <img src="/store/market.png" alt="The Socratica market stall" />
        </div>
      </main>
    </div>
  );
}
