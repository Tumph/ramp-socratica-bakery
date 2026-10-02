"use client";

import { useCallback, useEffect, useState } from "react";
import { productImageAssets } from "@/lib/store/product-assets";

type Vendor = { id: string; slug: string; displayName: string; active: boolean };
type Product = {
  id: string; vendorSlug: string; vendorName: string; name: string; description: string; unit: string;
  priceCents: number; perTeamLimit: number; inventoryQuantity: number; imageFilename: string; active: boolean;
};
type Form = { vendorSlug: string; name: string; description: string; unit: string; price: string; perTeamLimit: string; inventoryQuantity: string; imageFilename: string };

const blank = (): Form => ({
  vendorSlug: "", name: "", description: "", unit: "case", price: "", perTeamLimit: "4", inventoryQuantity: "0", imageFilename: productImageAssets[0] as string,
});

export function ProductAdmin() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [vendorResponse, productResponse] = await Promise.all([fetch("/api/admin/vendors"), fetch("/api/admin/products")]);
    const vendorData = await vendorResponse.json() as { vendors?: Vendor[]; error?: string };
    const productData = await productResponse.json() as { products?: Product[]; error?: string };
    if (!vendorResponse.ok) throw new Error(vendorData.error ?? "Unable to load vendors.");
    if (!productResponse.ok) throw new Error(productData.error ?? "Unable to load products.");
    setVendors(vendorData.vendors ?? []);
    setProducts(productData.products ?? []);
  }, []);

  // The catalogue is loaded once, then refreshed after each mutation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load products.")); }, [refresh]);

  const activeVendors = vendors.filter((vendor) => vendor.active);
  const activeProducts = products.filter((product) => product.active);
  const update = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));

  function close() {
    setAdding(false);
    setEditing(null);
    setForm({ ...blank(), vendorSlug: activeVendors[0]?.slug ?? "" });
  }

  function edit(product: Product) {
    setAdding(false);
    setEditing(product);
    setForm({
      vendorSlug: product.vendorSlug,
      name: product.name,
      description: product.description,
      unit: product.unit,
      price: (product.priceCents / 100).toFixed(2),
      perTeamLimit: String(product.perTeamLimit),
      inventoryQuantity: String(product.inventoryQuantity),
      imageFilename: product.imageFilename,
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const priceCents = Math.round(Number(form.price) * 100);
    const perTeamLimit = Number(form.perTeamLimit);
    const inventoryQuantity = Number(form.inventoryQuantity);
    if (!Number.isInteger(priceCents) || priceCents < 1) return setMessage("Enter a price greater than zero.");
    if (!Number.isInteger(perTeamLimit) || perTeamLimit < 1) return setMessage("Set a per-team limit of at least one.");
    if (!Number.isInteger(inventoryQuantity) || inventoryQuantity < 0) return setMessage("Inventory must be zero or more.");

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(editing ? `/api/admin/products/${editing.id}` : "/api/admin/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, priceCents, perTeamLimit, inventoryQuantity }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to save product.");
      setMessage(editing ? `${form.name} was updated.` : `${form.name} was added.`);
      close();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function archive(product: Product) {
    if (!window.confirm(`Archive ${product.name}? It will stay in historical records.`)) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to archive product.");
      setMessage(`${product.name} was archived.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rampAdminStack">
      <div className="rampAdminRowHead">
        <h2 className="rampAdminSectionTitle">Products</h2>
        {!adding && !editing && <button className="rampBtn rampBtn--primary" type="button" onClick={() => { close(); setAdding(true); }}>Add product</button>}
      </div>

      {(adding || editing) && (
        <form className="rampAdminCard rampProductForm" onSubmit={submit}>
          <div className="rampProductFormHead"><h3>{editing ? "Edit product" : "New product"}</h3><button type="button" className="rampProductClose" onClick={close}>Cancel</button></div>
          <div className="rampAdminGrid">
            <label><span>Vendor</span><select required value={form.vendorSlug} onChange={(event) => update("vendorSlug", event.target.value)}>{activeVendors.map((vendor) => <option key={vendor.id} value={vendor.slug}>{vendor.displayName}</option>)}</select></label>
            <label><span>Product name</span><input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
            <label className="rampAdminWide"><span>Description</span><textarea required rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
            <label><span>Sold as</span><input required list="product-units" value={form.unit} onChange={(event) => update("unit", event.target.value)} placeholder="e.g. case, tray, sack" /></label>
            <label><span>Price (CAD)</span><input required min="0.01" step="0.01" inputMode="decimal" value={form.price} onChange={(event) => update("price", event.target.value)} /></label>
            <label><span>Per-team limit</span><input required min="1" step="1" inputMode="numeric" value={form.perTeamLimit} onChange={(event) => update("perTeamLimit", event.target.value)} /></label>
            <label><span>Inventory available</span><input required min="0" step="1" inputMode="numeric" value={form.inventoryQuantity} onChange={(event) => update("inventoryQuantity", event.target.value)} /></label>
          </div>
          <datalist id="product-units"><option value="case" /><option value="box" /><option value="tray" /><option value="sack" /><option value="block" /><option value="bottle" /></datalist>
          <fieldset className="rampAdminFieldset"><legend>Product image</legend><div className="rampAdminChecks rampProductAssetGrid">{productImageAssets.map((asset) => <label key={asset} className={asset === form.imageFilename ? "rampAdminCheck rampProductAsset rampAdminCheck--on" : "rampAdminCheck rampProductAsset"}><input type="radio" name="product-image" checked={asset === form.imageFilename} onChange={() => update("imageFilename", asset)} /><img src={`/store/products/${asset}`} alt="" aria-hidden /><span>{asset}</span></label>)}</div></fieldset>
          <div className="rampAdminActions"><button className="rampBtn rampBtn--primary" disabled={saving || !activeVendors.length}>{saving ? "Saving…" : editing ? "Save changes" : "Create product"}</button></div>
        </form>
      )}

      {message && <p className="rampAdminHint" role="status">{message}</p>}
      <div className="rampAdminList">
        {activeProducts.map((product) => (
          <article key={product.id} className="rampAdminListRow">
            <img src={`/store/products/${product.imageFilename}`} alt="" aria-hidden />
            <div><strong>{product.name}</strong><span>{product.vendorName} · ${(product.priceCents / 100).toFixed(2)} / {product.unit}</span><small>{product.inventoryQuantity} in stock · limit {product.perTeamLimit} per team</small></div>
            <div className="rampAdminActions"><button type="button" className="rampBtn rampBtn--secondary" onClick={() => edit(product)}>Edit</button><button type="button" className="rampBtn rampBtn--secondary" disabled={saving} onClick={() => void archive(product)}>Archive</button></div>
          </article>
        ))}
      </div>
      {activeProducts.length === 0 && <p className="rampAdminNote">No active products yet.</p>}
    </div>
  );
}
