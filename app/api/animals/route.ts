import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRequest } from "@/lib/supabase";

const BUCKET_NAME = "Animals";

function buildPublicUrl(path: string) {
  const base = process.env.SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/${BUCKET_NAME}/${path}`;
}

async function signPhotoPath(path: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return "";
  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  try {
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${BUCKET_NAME}/${encodedPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
      }
    );
    if (!res.ok) return "";
    const json = await res.json();
    if (!json?.signedURL) return "";
    return `${supabaseUrl}${json.signedURL}`;
  } catch (err) {
    console.error("Failed to sign animal photo:", err);
    return "";
  }
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      animals: [],
      filters: { types: [], genders: [] },
      hasMore: false,
      nextCursor: null,
    });
  }

  try {
    const [animals, types, genders] = await Promise.all([
      supabaseRequest<any[]>("animals", {
        query: {
          select:
            "id,name,summary,daily_care_notes,birthday,age_label,age_months,milking_method,get_milked,breed,behaviors,stats,animal_type:animal_types(id,name,color),animal_gender:animal_genders(id,name,color),animal_photos:animal_photos(id,name,path,created_at)",
          order: "name.asc",
        },
      }),
      supabaseRequest<any[]>("animal_types", {
        query: { select: "name,color", order: "name.asc" },
      }),
      supabaseRequest<any[]>("animal_genders", {
        query: { select: "name,color", order: "name.asc" },
      }),
    ]);

    const normalized = await Promise.all(
      (animals || []).map(async (animal) => {
        const photos = await Promise.all(
          (animal.animal_photos || []).map(async (photo: any) => {
            const signed = await signPhotoPath(photo.path);
            return {
              name: photo.name,
              url: signed || buildPublicUrl(photo.path),
            };
          })
        );
        return {
          id: animal.id,
          name: animal.name,
          summary: animal.summary || "",
          dailyCareNotes: animal.daily_care_notes || "",
          birthday: animal.birthday,
          ageLabel: animal.age_label,
          ageMonths: animal.age_months ?? null,
          milkingMethod: animal.milking_method || "",
          getMilked: Boolean(animal.get_milked),
          type: animal.animal_type
            ? { name: animal.animal_type.name, color: animal.animal_type.color }
            : undefined,
          behaviors: animal.behaviors || [],
          breed: animal.breed || "",
          gender: animal.animal_gender
            ? { name: animal.animal_gender.name, color: animal.animal_gender.color }
            : undefined,
          photos,
          stats: animal.stats || {},
        };
      })
    );

    return NextResponse.json({
      animals: normalized,
      filters: { types: types || [], genders: genders || [] },
      hasMore: false,
      nextCursor: null,
    });
  } catch (err) {
    console.error("Failed to load animals:", err);
    return NextResponse.json(
      { animals: [], filters: { types: [], genders: [] }, hasMore: false, nextCursor: null },
      { status: 500 }
    );
  }
}
