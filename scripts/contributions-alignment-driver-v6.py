from pathlib import Path

source = Path('scripts/contributions-alignment-source.py').read_text()
marker = '# 10. Dedicated workflow watches the canonical Planner files and executes the new browser gate.'
if marker not in source:
    raise SystemExit('canonical alignment source marker not found')
product_only = source.split(marker, 1)[0]
exec(compile(product_only + "\nprint('Contributions canonical Planner product alignment applied.')\n", 'contributions-alignment-product-only', 'exec'), {'__name__': '__main__'})
