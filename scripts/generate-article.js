// Script lancé automatiquement par GitHub Actions (voir .github/workflows/generate-article.yml)

async function main() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;
  const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;

  if (!GEMINI_API_KEY || !JSONBIN_API_KEY || !JSONBIN_BIN_ID) {
    throw new Error("Variables manquantes : vérifie les secrets GitHub (GEMINI_API_KEY, JSONBIN_API_KEY, JSONBIN_BIN_ID)");
  }

  // --- 1. Récupérer les articles déjà publiés (pour éviter les doublons de sujet) ---
  const binRead = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
    headers: { "X-Master-Key": JSONBIN_API_KEY },
  });
  const binData = await binRead.json();
  const existingArticles = (binData.record && binData.record.articles) || [];
  const existingTitles = existingArticles.slice(0, 20).map(a => a.title).join(" | ");

  // --- 2. Demander à Gemini (gratuit) de rédiger un nouvel article ---
  const prompt = `Tu es rédacteur SEO pour TractoRent, une plateforme de location de tracteurs à l'international.

Rédige UN nouvel article de blog en français, sur un sujet DIFFÉRENT de ces titres déjà publiés : ${existingTitles || "aucun pour l'instant"}.

Thèmes possibles (choisis-en un, varie d'un article à l'autre) : choix de matériel agricole, comparatifs de tracteurs, conseils de location, entretien et maintenance, réglementation agricole, optimisation des coûts d'exploitation, actualités du secteur, techniques culturales.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, exactement dans cette forme :
{
  "slug": "slug-en-minuscules-avec-tirets-sans-accents",
  "category": "catégorie courte (2-3 mots)",
  "title": "titre accrocheur et optimisé SEO",
  "excerpt": "résumé de 150 à 160 caractères, façon méta-description Google",
  "content": [
    {"type": "p", "text": "paragraphe d'introduction"},
    {"type": "h2", "text": "premier sous-titre"},
    {"type": "p", "text": "paragraphe"},
    {"type": "h2", "text": "second sous-titre"},
    {"type": "ul", "items": ["point 1", "point 2", "point 3"]},
    {"type": "p", "text": "paragraphe de conclusion"}
  ]
}

Contraintes : 500 à 700 mots au total, 3 à 5 sous-titres (h2), ton expert mais accessible, informations concrètes et vérifiables (pas de chiffres inventés présentés comme des statistiques officielles). Ne termine pas par un appel à l'action commercial explicite : le site en ajoute déjà un automatiquement.`;

  const geminiRes = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    throw new Error("Erreur API Gemini: " + errText);
  }

  const geminiData = await geminiRes.json();
  const rawText = geminiData.candidates[0].content.parts[0].text.trim();
  const cleanText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
  const article = JSON.parse(cleanText);

  // --- 3. Compléter les métadonnées ---
  const COVER_IMAGES = [
    "https://images.unsplash.com/photo-1717702576954-c07131c54169?auto=format&fit=crop&w=1200&h=700&q=70",
    "https://images.unsplash.com/photo-1755498591537-eb54d2d54351?auto=format&fit=crop&w=1200&h=700&q=70",
    "https://images.unsplash.com/photo-1633555269939-bc019a4bc4b6?auto=format&fit=crop&w=1200&h=700&q=70",
    "https://images.unsplash.com/photo-1653156392599-10de5367c555?auto=format&fit=crop&w=1200&h=700&q=70",
    "https://images.unsplash.com/photo-1719254500669-2bc432c43933?auto=format&fit=crop&w=1200&h=700&q=70",
  ];
  article.date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const wordCount = article.content.filter(b => b.type === "p").reduce((n, b) => n + b.text.split(" ").length, 0);
  article.readTime = Math.max(3, Math.round(wordCount / 200)) + " min";
  article.cover = COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)];

  // --- 4. Sauvegarder (le nouvel article en tête de liste, 60 max conservés) ---
  const updatedArticles = [article, ...existingArticles].slice(0, 60);
  const binWrite = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": JSONBIN_API_KEY,
    },
    body: JSON.stringify({ articles: updatedArticles }),
  });

  if (!binWrite.ok) {
    const errText = await binWrite.text();
    throw new Error("Erreur sauvegarde jsonbin: " + errText);
  }

  console.log("Article publié :", article.title);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
