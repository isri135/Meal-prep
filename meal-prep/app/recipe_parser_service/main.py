from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import re
import spacy

app = FastAPI()

# Allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

nlp = spacy.load("en_core_web_sm")

MEASURE_WORDS = {
    "cup", "cups", "tbsp", "tablespoon", "tablespoons",
    "tsp", "teaspoon", "teaspoons",
    "gram", "grams", "g", "kg",
    "ml", "liter", "liters",
    "oz", "ounce", "ounces",
    "pound", "lb", "clove", "cloves",
    "slice", "slices"
}

COOKING_VERBS = {
    "add", "mix", "stir", "cook", "heat", "bake", "fry",
    "boil", "chop", "slice", "combine", "pour",
    "season", "serve", "preheat", "whisk", "saute", "sauté",
    "simmer", "grill", "roast", "blend"
}

def extract_ingredients(text: str):
    doc = nlp(text.lower())
    ingredients = set()

    # Pattern: number + measure + ingredient phrase
    for sent in doc.sents:
        tokens = [t.text for t in sent]
        for i, tok in enumerate(tokens):
            if tok.replace(".", "", 1).isdigit() and i + 2 < len(tokens):
                if tokens[i + 1] in MEASURE_WORDS:
                    phrase_tokens = tokens[i + 2:i + 6]
                    phrase = " ".join(
                        t for t in phrase_tokens
                        if t and (t.isalpha() or t.replace("-", "").isalpha())
                    ).strip()
                    if phrase:
                        ingredients.add(phrase)

    # Fallback: noun chunks in sentences that contain cooking verbs
    for sent in doc.sents:
        sent_l = sent.text.lower()
        if any(v in sent_l for v in COOKING_VERBS):
            for chunk in sent.noun_chunks:
                cand = chunk.text.lower().strip()
                if len(cand) >= 3 and cand not in {"a pan", "the pan", "a pot", "the pot"}:
                    ingredients.add(cand)

    cleaned = set(re.sub(r"[^\w\s-]", "", ing).strip() for ing in ingredients)
    cleaned = set(ing for ing in cleaned if len(ing) >= 3)
    return sorted(cleaned)

def extract_steps(text: str):
    doc = nlp(text)
    steps = []

    for sent in doc.sents:
        s = sent.text.strip()
        if not s:
            continue

        first = s.split(" ", 1)[0].lower().strip(",.")
        if first in COOKING_VERBS:
            steps.append(s)
            continue

        for tok in sent:
            if tok.lemma_.lower() in COOKING_VERBS and tok.pos_ == "VERB":
                steps.append(s)
                break

    # unique preserve order
    seen = set()
    out = []
    for s in steps:
        if s not in seen:
            out.append(s)
            seen.add(s)
    return out

@app.post("/parse")
async def parse(transcript: str = Body(embed=True)):
    if not transcript or not transcript.strip():
        raise HTTPException(status_code=400, detail="Missing transcript")

    ingredients = extract_ingredients(transcript)
    steps = extract_steps(transcript)

    return {
        "ingredients": ingredients,
        "steps": [{"step": i + 1, "instruction": s} for i, s in enumerate(steps)],
    }

