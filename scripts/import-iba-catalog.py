#!/usr/bin/env python3
"""Fetch official IBA recipes, then assemble the reviewed Chinese backend catalog.

Usage: python3 scripts/import-iba-catalog.py [--refresh]
Requires requests only for --refresh. Offline builds use the committed source snapshot.
The importer fails on source/editorial drift; review translations before publishing updates.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from html import unescape
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / 'data/iba-cocktails/recipes-source.json'
EDITORIAL = ROOT / 'server/data/iba-editorial.json'
OUTPUT = ROOT / 'server/data/catalog.json'
SITEMAP = 'https://iba-world.com/wp-sitemap-posts-iba-cocktail-1.xml'
CATEGORIES = {'the-unforgettables': 'unforgettables', 'contemporary-classics': 'contemporary_classics', 'new-era': 'new_era'}


def clean(fragment):
    fragment = re.sub(r'<(?:br|/p|/li)\b[^>]*>', '\n', fragment, flags=re.I)
    return [re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', '', line))).strip() for line in fragment.splitlines() if re.sub(r'<[^>]+>', '', line).strip()]


def section(html, heading):
    match = re.search(r'<h4\b[^>]*>\s*' + heading + r'\s*</h4>(.*?)(?=<h[45]\b|</main>)', html, re.I | re.S)
    if not match:
        return []
    shortcode = re.search(r'<div class="elementor-shortcode">(.*?)</div>', match.group(1), re.S)
    return clean(shortcode.group(1)) if shortcode else []


def refresh():
    import requests
    def get(url):
        last_error = None
        for attempt in range(3):
            try:
                response = requests.get(url, timeout=20, headers={'User-Agent': 'CatTavern-IBA-catalog/1.0'})
                response.raise_for_status()
                return response.text
            except requests.RequestException as error:
                last_error = error
        raise RuntimeError(f'Official IBA request failed after 3 attempts: {url}') from last_error
    xml = get(SITEMAP)
    urls = [node.text for node in ET.fromstring(xml).iter() if node.tag.endswith('}loc') and re.match(r'https://iba-world.com/iba-cocktail/[^/]+/$', node.text or '')]
    if len(urls) != len(set(urls)) or not urls:
        raise ValueError('Sitemap contains no recipes or duplicate URLs')
    def page(url):
        html = get(url)
        slug = url.rstrip('/').rsplit('/', 1)[-1]
        category = re.search(r'cocktail-category-([a-z-]+)', html).group(1)
        if category not in CATEGORIES:
            raise ValueError(f'Unknown IBA category {category}: {url}')
        heading = re.search(r'<h1\b[^>]*>(.*?)</h1\s*>', html, re.S)
        if not heading:
            raise ValueError(f'No page title: {url}')
        result = {'slug': slug, 'source_url': url, 'name_en': clean(heading.group(1))[0], 'iba_category': CATEGORIES[category], 'ingredients': section(html, 'Ingredients'), 'method': section(html, 'Method'), 'garnish': section(html, 'Garnish')}
        if not result['ingredients'] or not result['method']:
            raise ValueError(f'Incomplete official recipe: {url}')
        return result
    with ThreadPoolExecutor(max_workers=6) as executor:
        recipes = list(executor.map(page, urls))
    SNAPSHOT.write_text(json.dumps({'source_sitemap': SITEMAP, 'fetched_at': datetime.now(timezone.utc).isoformat(), 'cocktails': recipes}, ensure_ascii=False, indent=2) + '\n')
    print(f'Fetched {len(recipes)} official IBA recipes')


def build(check=False):
    source = json.loads(SNAPSHOT.read_text())
    editorial = json.loads(EDITORIAL.read_text())
    manifest = json.loads((ROOT / 'data/iba-cocktails/manifest.json').read_text())
    images = {row['slug']: row for row in manifest['cocktails']}
    reviewed = {row['id']: row for row in editorial['cocktails']}
    if set(reviewed) != {row['slug'] for row in source['cocktails']} or set(reviewed) != set(images):
        raise ValueError('Source, Chinese editorial and image manifest must cover exactly the same cocktails')
    dictionary = {row['id']: row for row in editorial['ingredients']}
    recipes = []
    for official in source['cocktails']:
        slug = official['slug']
        row = dict(reviewed[slug])
        if row.pop('source_ingredients') != official['ingredients'] or row.pop('source_method') != official['method'] or row.pop('source_garnish') != official['garnish']:
            raise ValueError(f'Official recipe changed, review Chinese translation: {slug}')
        row.update(name_en=official['name_en'], iba_category=official['iba_category'], source_url=official['source_url'], image_url='/media/cocktails/' + images[slug]['crayon_file'], image_original_url='/media/cocktails/' + images[slug]['original_file'])
        for ingredient in row['ingredients']:
            ingredient['name'] = dictionary[ingredient['ingredient_id']]['name_zh']
        if len({item['ingredient_id'] for item in row['ingredients']}) != len(row['ingredients']):
            raise ValueError(f'Duplicate ingredient ID: {slug}')
        recipes.append(row)
    rendered = json.dumps({'version': editorial['version'], 'cocktails': recipes, 'ingredients': editorial['ingredients']}, ensure_ascii=False, indent=2) + '\n'
    if check:
        if OUTPUT.read_text() != rendered:
            raise ValueError('Backend catalog is out of date; run python3 scripts/import-iba-catalog.py')
    else:
        OUTPUT.write_text(rendered)
    print(f'Built {len(recipes)} cocktails and {len(dictionary)} ingredients: {OUTPUT}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Fetch sitemap and all official recipe pages before building')
    parser.add_argument('--fetch-only', action='store_true', help='Refresh source snapshot without rebuilding reviewed Chinese data')
    parser.add_argument('--check', action='store_true', help='Verify the committed catalog matches source and editorial without writing')
    args = parser.parse_args()
    if args.refresh or args.fetch_only:
        refresh()
    if not args.fetch_only:
        build(check=args.check)
