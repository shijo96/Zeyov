#!/usr/bin/env python3
"""
ZEYOV - Automated Shopify Collection Creator & Product Organizer
Creates all 5 Master Collections and 23 Subcollections via Shopify Admin REST / GraphQL API.
Usage:
    export SHOPIFY_SHOP="zeyov.myshopify.com"
    export SHOPIFY_ADMIN_TOKEN="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
    python3 scripts/create_shopify_collections.py
"""

import os
import sys
import json
import urllib.request
import urllib.error

# Complete Department & Subcollection Architecture
COLLECTIONS_BLUEPRINT = [
    # 1. Kidswear & Subcollections
    {
        "title": "Kidswear",
        "handle": "kidswear",
        "body_html": "<p>Gentle, skin-friendly fabrics, playful silhouettes, and durable everyday essentials for babies, boys, and girls.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "department:kids"}
    },
    {
        "title": "Baby Clothing",
        "handle": "baby-clothing",
        "body_html": "<p>Ultra-soft organic cotton and flannel essentials specially crafted for newborns and infants.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:baby-clothing"}
    },
    {
        "title": "Baby Rompers & Onesies",
        "handle": "baby-rompers",
        "body_html": "<p>Cozy reversible thermal and breathable cotton rompers with hassle-free snaps.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "product_type:romper"}
    },
    {
        "title": "Boys Clothing",
        "handle": "boys-clothing",
        "body_html": "<p>Play-ready shirts, tees, trousers, and ethnic sets tailored for young gentlemen.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:boys-clothing"}
    },
    {
        "title": "Girls Clothing",
        "handle": "girls-clothing",
        "body_html": "<p>Charming dresses, frocks, ethnic wear, and coord sets for young fashionistas.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:girls-clothing"}
    },
    {
        "title": "Kids Dresses",
        "handle": "kids-dresses",
        "body_html": "<p>Occasion-ready party frocks and breathable everyday dresses for girls.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:kids-dresses"}
    },
    {
        "title": "Kids Tops & Bottoms",
        "handle": "kids-tops-bottoms",
        "body_html": "<p>Versatile t-shirts, joggers, shorts, and skirts for active days.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:kids-tops-bottoms"}
    },
    {
        "title": "Kids Accessories",
        "handle": "kids-accessories",
        "body_html": "<p>Soft caps, mittens, bibs, and adorable styling accents for children.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:kids-accessories"}
    },

    # 2. Women's Wear & Subcollections
    {
        "title": "Women's Wear",
        "handle": "womens-wear",
        "body_html": "<p>Sculpted silhouettes, flowing silks, tailored outerwear, and modern Indian pret-a-porter.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "department:women"}
    },
    {
        "title": "Dresses & Gowns",
        "handle": "womens-dresses",
        "body_html": "<p>Elegantly draped evening gowns, midi dresses, and effortless day dresses.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:womens-dresses"}
    },
    {
        "title": "Tops & T-Shirts",
        "handle": "womens-tops-tshirts",
        "body_html": "<p>Premium knit tops, ribbed tees, and breathable everyday fashion tops.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:womens-tops-tshirts"}
    },
    {
        "title": "Shirts & Blouses",
        "handle": "womens-shirts",
        "body_html": "<p>Crisp poplin button-downs, fluid satin shirts, and versatile workwear blouses.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:womens-shirts"}
    },
    {
        "title": "Kurtis & Ethnic Wear",
        "handle": "kurtis-ethnic-wear",
        "body_html": "<p>Artisanal embroidered kurtas, handcrafted anarkalis, and festive ethnic separates.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:kurtis-ethnic-wear"}
    },
    {
        "title": "Western Wear",
        "handle": "western-wear",
        "body_html": "<p>Tailored blazers, chic outerwear, and contemporary western wardrobe staples.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:western-wear"}
    },
    {
        "title": "Co-ord Sets",
        "handle": "coord-sets",
        "body_html": "<p>Seamlessly paired monochrome and printed coordinate sets for effortless style.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:coord-sets"}
    },
    {
        "title": "Bottomwear",
        "handle": "womens-bottomwear",
        "body_html": "<p>High-waisted trousers, tailored palazzos, and luxury casual bottoms.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:womens-bottomwear"}
    },
    {
        "title": "Women's Accessories",
        "handle": "womens-accessories",
        "body_html": "<p>Silk scarves, statement belts, and curated accents to complete the ensemble.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:womens-accessories"}
    },

    # 3. Men's Wear & Subcollections
    {
        "title": "Men's Wear",
        "handle": "mens-wear",
        "body_html": "<p>Sharp tailoring, refined casual essentials, and traditional Indian craftsmanship for men.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "department:men"}
    },
    {
        "title": "T-Shirts & Polos",
        "handle": "mens-tshirts",
        "body_html": "<p>Pima cotton crewnecks, textured polo shirts, and minimal everyday staples.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:mens-tshirts"}
    },
    {
        "title": "Shirts",
        "handle": "mens-shirts",
        "body_html": "<p>Tailored linen button-downs, crisp Oxford shirts, and relaxed weekend overshirts.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:mens-shirts"}
    },
    {
        "title": "Trousers & Chinos",
        "handle": "mens-trousers",
        "body_html": "<p>Pleated dress trousers, stretch chinos, and modern tailored pants.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:mens-trousers"}
    },
    {
        "title": "Jeans",
        "handle": "mens-jeans",
        "body_html": "<p>Premium selvedge and stretch denim crafted for enduring comfort and fit.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:mens-jeans"}
    },
    {
        "title": "Casual Wear",
        "handle": "mens-casual-wear",
        "body_html": "<p>Relaxed-fit overshirts, layerable jackets, and everyday weekend staples.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:mens-casual-wear"}
    },
    {
        "title": "Ethnic Wear",
        "handle": "mens-ethnic-wear",
        "body_html": "<p>Regal bandhgalas, raw silk kurtas, and handcrafted festive ensembles.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:mens-ethnic-wear"}
    },
    {
        "title": "Men's Accessories",
        "handle": "mens-accessories",
        "body_html": "<p>Full-grain leather belts, pocket squares, and minimalist accessories.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "category:mens-accessories"}
    },

    # 4. Festive Collection & Subcollections
    {
        "title": "Festive Collection",
        "handle": "festive-collection",
        "body_html": "<p>Bespoke royal festive couture for weddings, Onam, Diwali, Eid, Christmas, and grand celebrations.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:festive"}
    },
    {
        "title": "Christmas Collection",
        "handle": "christmas-collection",
        "body_html": "<p>Deep emerald, ruby crimson, and festive winter silks for Christmas and holiday parties.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:christmas"}
    },
    {
        "title": "Onam Collection",
        "handle": "onam-collection",
        "body_html": "<p>Traditional ivory and kasavu gold handloom weaves, festive pattu pavadas, and festive shirts.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:onam"}
    },
    {
        "title": "Vishu Collection",
        "handle": "vishu-collection",
        "body_html": "<p>Luminous gold and emerald hues celebrating renewal and auspicious beginnings.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:vishu"}
    },
    {
        "title": "Eid Collection",
        "handle": "eid-collection",
        "body_html": "<p>Graceful embroidery, fluid chiffons, and celebratory ethnic tailoring.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:eid"}
    },
    {
        "title": "Diwali Collection",
        "handle": "diwali-collection",
        "body_html": "<p>Warm saffron, deep gold, and zari-detailed silhouettes illuminating the festival of lights.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:diwali"}
    },
    {
        "title": "New Year Collection",
        "handle": "new-year-collection",
        "body_html": "<p>Glamorous silhouettes, structured eveningwear, and midnight sparkles to ring in the new year.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:new-year"}
    },
    {
        "title": "Valentine's Collection",
        "handle": "valentines-collection",
        "body_html": "<p>Romantic blush silks, tailored date-night ensembles, and curated luxury gifting pieces.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:valentines"}
    },
    {
        "title": "Festival Specials",
        "handle": "festival-specials",
        "body_html": "<p>Limited capsule drops curated exclusively for festive seasons.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:festive-specials"}
    },

    # 5. Core Shopping Collections
    {
        "title": "Trending Now",
        "handle": "trending-now",
        "body_html": "<p>The most coveted runaway pieces and high-engagement wardrobe staples.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:trending"}
    },
    {
        "title": "Featured Products",
        "handle": "featured-products",
        "body_html": "<p>Hand-picked statement creations representing the peak of ZEYOV craftsmanship.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:featured"}
    },
    {
        "title": "Special Offers",
        "handle": "special-offers",
        "body_html": "<p>Privilege pricing on select archive pieces and runway favorites.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:offers"}
    },
    {
        "title": "Sale",
        "handle": "sale",
        "body_html": "<p>Seasonal reductions on limited-inventory apparel and accessories.</p>",
        "rule": {"column": "tag", "relation": "equals", "condition": "collection:sale"}
    }
]

def main():
    shop = os.environ.get("SHOPIFY_SHOP", "").strip()
    token = os.environ.get("SHOPIFY_ADMIN_TOKEN", "").strip()

    if not shop or not token:
        print("[!] Shopify Admin credentials missing.")
        print("    To automatically provision all 28 collections in your Shopify Admin database:")
        print("    export SHOPIFY_SHOP='zeyov.myshopify.com'")
        print("    export SHOPIFY_ADMIN_TOKEN='shpat_xxxxxxxxxxxxxxxxxxxxxxxx'")
        print("    python3 scripts/create_shopify_collections.py")
        print("\n[+] Total Collections in Blueprint:", len(COLLECTIONS_BLUEPRINT))
        print("    Writing offline blueprint to scripts/collections_blueprint.json...")
        with open("scripts/collections_blueprint.json", "w") as f:
            json.dump(COLLECTIONS_BLUEPRINT, f, indent=2)
        print("    Blueprint written successfully.")
        return 0

    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token
    }

    url = f"https://{shop}/admin/api/2024-01/smart_collections.json"

    print(f"[*] Provisioning {len(COLLECTIONS_BLUEPRINT)} collections to https://{shop}...")

    success = 0
    for col in COLLECTIONS_BLUEPRINT:
        payload = {
            "smart_collection": {
                "title": col["title"],
                "handle": col["handle"],
                "body_html": col["body_html"],
                "rules": [col["rule"]],
                "published_scope": "global"
            }
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                res_data = json.loads(resp.read().decode())
                created = res_data.get("smart_collection", {})
                print(f"  [✓] Created: {created.get('title')} (handle: {created.get('handle')})")
                success += 1
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            if "already exists" in err_body or "handle has already been taken" in err_body:
                print(f"  [-] Already exists: {col['title']} ({col['handle']})")
                success += 1
            else:
                print(f"  [✗] Error creating {col['title']}: {e.code} {err_body}")

    print(f"\n[✓] Provisioning complete: {success}/{len(COLLECTIONS_BLUEPRINT)} active.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
