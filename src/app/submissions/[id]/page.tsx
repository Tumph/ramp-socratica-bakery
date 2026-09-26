/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { submissionImageUrl } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const admin = createAdminClient();
  const { data: submission } = await admin.from("submissions").select("id,title,tagline,story_markdown,updated_at,teams!inner(name)").eq("id", id).maybeSingle();
  if (!submission) notFound();
  const [{ data: links }, { data: assets }] = await Promise.all([admin.from("submission_links").select("id,kind,label,url,position").eq("submission_id", id).order("position"), admin.from("submission_assets").select("id,storage_path,caption,alt_text,position").eq("submission_id", id).order("position")]);
  const team = submission.teams as unknown as { name: string };
  return <main className="submissionPage"><section className="submissionHero"><p className="eyebrow">Socratica Bakery Hackathon</p><h1>{submission.title || team.name}</h1>{submission.tagline && <p className="heroCopy">{submission.tagline}</p>}<p className="mutedCopy">Built by {team.name}</p></section>{assets?.length ? <section className="publicGallery">{assets.map((asset) => <figure key={asset.id}><img src={submissionImageUrl(asset.storage_path)} alt={asset.alt_text ?? asset.caption ?? "Project image"} />{asset.caption && <figcaption>{asset.caption}</figcaption>}</figure>)}</section> : null}<section className="submissionBody"><div><h2>About the project</h2><p className="submissionStory">{submission.story_markdown || "Project details will be added soon."}</p></div><aside className="panel projectLinks"><h2>Explore</h2>{links?.length ? links.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer"><span>{link.kind}</span>{link.label}</a>) : <p className="mutedCopy">Links will be added soon.</p>}</aside></section></main>;
}
