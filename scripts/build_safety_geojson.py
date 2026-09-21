#!/usr/bin/env python3
"""Build the compact London LSOA safety choropleth used by the web app."""

from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import subprocess
import tempfile
from collections import Counter
from pathlib import Path


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def read_population(workbook: Path, work_dir: Path) -> dict[str, int]:
    csv_dir = work_dir / "population"
    run(
        [
            "ogr2ogr",
            "-f",
            "CSV",
            str(csv_dir),
            str(workbook),
            "Mid-2024 LSOA 2021",
        ]
    )

    population_csv = next(csv_dir.glob("*.csv"))
    populations: dict[str, int] = {}
    with population_csv.open(encoding="utf-8-sig", newline="") as source:
        rows = csv.reader(source)
        for row in rows:
            if len(row) >= 5 and row[2] == "LSOA 2021 Code":
                break
        for row in rows:
            if len(row) >= 5 and row[2].startswith("E01") and row[4]:
                populations[row[2]] = int(float(row[4].replace(",", "")))
    return populations


def read_crime_counts(crime_csv: Path) -> Counter[str]:
    counts: Counter[str] = Counter()
    with crime_csv.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            lsoa_code = (row.get("LSOA code") or "").strip()
            if lsoa_code:
                counts[lsoa_code] += 1
    return counts


def quantile(values: list[float], fraction: float) -> float:
    position = (len(values) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return values[lower]
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def safety_level(rate: float, breaks: list[float]) -> int:
    for index, boundary in enumerate(breaks, start=1):
        if rate <= boundary:
            return index
    return 5


def build_boundaries(boundaries_dir: Path, work_dir: Path) -> Path:
    shape_files = sorted(boundaries_dir.rglob("*.shp"))
    if not shape_files:
        raise ValueError(f"No shapefiles found below {boundaries_dir}")

    merged = work_dir / "london-lsoa.gpkg"
    run(
        [
            "ogrmerge.py",
            "-single",
            "-overwrite_ds",
            "-f",
            "GPKG",
            "-o",
            str(merged),
            "-nln",
            "lsoa",
            "-field_strategy",
            "Intersection",
            *map(str, shape_files),
        ]
    )

    simplified = work_dir / "london-lsoa.geojson"
    run(
        [
            "ogr2ogr",
            "-f",
            "GeoJSON",
            str(simplified),
            str(merged),
            "lsoa",
            "-t_srs",
            "EPSG:4326",
            "-select",
            "lsoa21cd,lsoa21nm,lad22nm",
            "-simplify",
            "12",
            "-lco",
            "COORDINATE_PRECISION=5",
        ]
    )
    return simplified


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--boundaries", type=Path, required=True)
    parser.add_argument("--crime", type=Path, required=True)
    parser.add_argument("--population", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    for executable in ("ogr2ogr", "ogrmerge.py"):
        if not shutil.which(executable):
            raise RuntimeError(f"{executable} is required (install GDAL)")

    crime_counts = read_crime_counts(args.crime)
    with tempfile.TemporaryDirectory(prefix="all4land-") as temporary:
        work_dir = Path(temporary)
        populations = read_population(args.population, work_dir)
        boundaries_file = build_boundaries(args.boundaries, work_dir)
        geojson = json.loads(boundaries_file.read_text(encoding="utf-8"))

    rates: list[float] = []
    for feature in geojson["features"]:
        properties = feature["properties"]
        if properties["lad22nm"] == "City of London":
            continue
        code = properties["lsoa21cd"]
        population = populations.get(code)
        if population:
            rates.append(crime_counts[code] * 1000 / population)

    rates.sort()
    breaks = [round(quantile(rates, fraction), 2) for fraction in (0.2, 0.4, 0.6, 0.8)]

    for feature in geojson["features"]:
        original = feature["properties"]
        code = original["lsoa21cd"]
        population = populations.get(code)
        has_data = original["lad22nm"] != "City of London" and population is not None
        count = crime_counts[code] if has_data else None
        rate = round(count * 1000 / population, 2) if has_data else None
        feature["properties"] = {
            "code": code,
            "name": original["lsoa21nm"],
            "borough": original["lad22nm"],
            "crimeCount": count,
            "population": population,
            "crimeRate": rate,
            "level": safety_level(rate, breaks) if has_data else 0,
        }

    geojson["metadata"] = {
        "crimeMonth": "2026-07",
        "populationYear": 2024,
        "unit": "crimes per 1,000 residents",
        "quantileBreaks": breaks,
        "featureCount": len(geojson["features"]),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(geojson, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
