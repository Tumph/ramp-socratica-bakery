"use client";

import { useCallback, useEffect, useState } from "react";

type Vendor = { id: string; slug: string; displayName: string; active: boolean };
type Product = { vendorSlug: string; active: boolean };

export function VendorAdmin() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [adding, setAdding] = useState(false);
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [vendorResponse, productResponse] = await Promise.all([
      fetch("/api/admin/vendors"),
      fetch("/api/admin/products"),
    ]);
    const vendorData = await vendorResponse.json() as { vendors?: Vendor[]; error?: string };
    const productData = await productResponse.json() as { products?: Product[]; error?: string };
    if (!vendorResponse.ok) throw new Error(vendorData.error ?? "Unable to load vendors.");
    if (!productResponse.ok) throw new Error(productData.error ?? "Unable to load products.");
    setVendors(vendorData.vendors ?? []);
    setProducts(productData.products ?? []);
  }, []);

  // Load from the catalogue API once and after a mutation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load vendors.")); }, [refresh]);

  function resetForm() {
    setAdding(false);
    setEditing(null);
    setSlug("");
    setDisplayName("");
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, displayName }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to create vendor.");
      setMessage(`${displayName} was added.`);
      resetForm();
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create vendor.");
    } finally {
      setSaving(false);
    }
  }

  async function save(vendor: Vendor, active = vendor.active) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/vendors/${vendor.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: vendor.displayName, active }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update vendor.");
      setMessage(active ? `${vendor.displayName} was updated.` : `${vendor.displayName} was archived.`);
      setEditing(null);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update vendor.");
    } finally {
      setSaving(false);
    }
  }

  function patchName(slugToPatch: string, nextName: string) {
    setVendors((current) => current.map((vendor) => vendor.slug === slugToPatch ? { ...vendor, displayName: nextName } : vendor));
  }

  return (
    <div className="rampAdminStack">
      <div className="rampAdminRowHead">
        <div>
          <h2 className="rampAdminSectionTitle">Vendors</h2>
        </div>
        {!adding && <button type="button" className="rampBtn rampBtn--primary" onClick={() => setAdding(true)}>Add vendor</button>}
      </div>

      {adding && (
        <form className="rampAdminCard rampAdminStack" onSubmit={create}>
          <h3>Add vendor</h3>
          <div className="rampAdminGrid">
            <label><span>Vendor name</span><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
            <label><span>URL slug</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} /></label>
          </div>
          <div className="rampAdminActions"><button className="rampBtn rampBtn--primary" disabled={saving}>{saving ? "Saving…" : "Create vendor"}</button><button type="button" className="rampBtn rampBtn--secondary" onClick={resetForm}>Cancel</button></div>
        </form>
      )}

      {message && <p className="rampAdminHint" role="status">{message}</p>}
      <div className="rampAdminList">
        {vendors.map((vendor) => {
          const activeProductCount = products.filter((product) => product.active && product.vendorSlug === vendor.slug).length;
          const isEditing = editing === vendor.slug;
          return (
            <article key={vendor.id} className="rampAdminListRow">
              <div className="rampAdminStoreIdentity">
                {isEditing ? <input aria-label={`Vendor name for ${vendor.slug}`} value={vendor.displayName} onChange={(event) => patchName(vendor.slug, event.target.value)} /> : <strong>{vendor.displayName}</strong>}
                <span>/{vendor.slug} · {activeProductCount} active product{activeProductCount === 1 ? "" : "s"}</span>
              </div>
              <div className="rampAdminActions">
                {isEditing ? <><button type="button" className="rampBtn rampBtn--primary" disabled={saving} onClick={() => void save(vendor)}>Save</button><button type="button" className="rampBtn rampBtn--secondary" onClick={() => { setEditing(null); void refresh(); }}>Cancel</button></> : <button type="button" className="rampBtn rampBtn--secondary" onClick={() => setEditing(vendor.slug)}>Edit</button>}
                {vendor.active ? <button type="button" className="rampBtn rampBtn--secondary" disabled={saving} onClick={() => { if (window.confirm(`Archive ${vendor.displayName}?`)) void save(vendor, false); }}>Archive</button> : <button type="button" className="rampBtn rampBtn--secondary" disabled={saving} onClick={() => void save(vendor, true)}>Restore</button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
