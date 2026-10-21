#!/usr/bin/env python3
"""Build the four compact London LSOA choropleth indicators used by the map."""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import subprocess
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely import STRtree, make_valid
from shapely.geometry import Point, shape
from shapely.ops import transform, unary_union


TO_BNG = Transformer.from_crs("EPSG:4326", "EPSG:27700", always_xy=True).transform


def quantile(values: list[float], fraction: float) -> float:
    position = (len(values) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return values[lower]
    return values[lower] + (values[upper] - values[lower]) * (position - lower)


def quantile_breaks(values: list[float], fractions: tuple[float, ...]) -> list[float]:
    ordered = sorted(values)
    return [round(quantile(ordered, fraction), 2) for fraction in fractions]


def level(value: float | None, breaks: list[float], offset: int = 1) -> int | None:
    if value is None:
        return None
    for index, boundary in enumerate(breaks, start=offset):
        if value <= boundary:
            return index
    return offset + len(breaks)


def read_crimes(crime_dir: Path, valid_codes: set[str]) -> tuple[Counter[str], dict[str, int]]:
    counts: Counter[str] = Counter()
    rows = matched = missing_code = 0
    files = sorted(crime_dir.rglob("*-street.csv"))
    if not files:
        raise ValueError(f"No *-street.csv files found below {crime_dir}")

    for crime_file in files:
        with crime_file.open(encoding="utf-8-sig", newline="") as source:
            for row in csv.DictReader(source):
                rows += 1
                code = (row.get("LSOA code") or "").strip()
                if not code:
                    missing_code += 1
                elif code in valid_codes:
                    counts[code] += 1
                    matched += 1

    return counts, {
        "sourceFileCount": len(files),
        "sourceRowCount": rows,
        "matchedLondonRowCount": matched,
        "missingLsoaRowCount": missing_code,
        "outsideLondonRowCount": rows - matched - missing_code,
    }


def read_airbnb(
    airbnb_json: Path,
    polygons: list,
    tree: STRtree,
) -> tuple[dict[int, list[float]], dict[str, int]]:
    payload = json.loads(airbnb_json.read_text(encoding="utf-8"))
    prices: dict[int, list[float]] = defaultdict(list)
    unmatched = 0

    for listing in payload["listings"]:
        point = Point(TO_BNG(listing["longitude"], listing["latitude"]))
        matches = tree.query(point, predicate="within")
        if len(matches) == 0:
            unmatched += 1
            continue
        polygon_index = int(matches[0])
        if polygons[polygon_index].covers(point):
            prices[polygon_index].append(float(listing["priceTotal"]))
        else:
            unmatched += 1

    return prices, {
        "sourceRowCount": len(payload["listings"]),
        "matchedRowCount": sum(map(len, prices.values())),
        "outsideLondonRowCount": unmatched,
    }


def load_greenspace_files(paths: list[Path], work_dir: Path) -> tuple[list, int]:
    geometries = []
    source_features = 0
    for index, source_path in enumerate(paths):
        converted = work_dir / f"greenspace-{index}.geojson"
        subprocess.run(
            [
                "ogr2ogr",
                "-f",
                "GeoJSON",
                str(converted),
                str(source_path),
                "-t_srs",
                "EPSG:27700",
            ],
            check=True,
        )
        collection = json.loads(converted.read_text(encoding="utf-8"))
        source_features += len(collection["features"])
        for feature in collection["features"]:
            geometry = make_valid(shape(feature["geometry"]))
            if not geometry.is_empty:
                geometries.append(geometry)
    return geometries, source_features


def greenspace_cover(polygons: list, greenspaces: list) -> tuple[list[float], int]:
    tree = STRtree(greenspaces)
    percentages = []
    intersected_sites: set[int] = set()

    for polygon in polygons:
        candidates = tree.query(polygon, predicate="intersects")
        pieces = []
        for candidate_index in candidates:
            candidate = greenspaces[int(candidate_index)]
            clipped = polygon.intersection(candidate)
            if not clipped.is_empty:
                pieces.append(clipped)
                intersected_sites.add(int(candidate_index))
        covered_area = unary_union(pieces).area if pieces else 0.0
        percentages.append(round(min(100.0, covered_area / polygon.area * 100), 2))

    return percentages, len(intersected_sites)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--crime-dir", type=Path, required=True)
    parser.add_argument("--airbnb", type=Path, required=True)
    parser.add_argument("--greenspace", type=Path, nargs="+", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    collection = json.loads(args.base.read_text(encoding="utf-8"))
    features = collection["features"]
    polygons = [make_valid(transform(TO_BNG, shape(feature["geometry"]))) for feature in features]
    polygon_tree = STRtree(polygons)
    valid_codes = {feature["properties"]["code"] for feature in features}

    crimes, crime_qa = read_crimes(args.crime_dir, valid_codes)
    accommodation_prices, accommodation_qa = read_airbnb(args.airbnb, polygons, polygon_tree)
    with tempfile.TemporaryDirectory(prefix="all4land-greenspace-") as temporary:
        greenspaces, source_greenspaces = load_greenspace_files(args.greenspace, Path(temporary))
        greenspace_percentages, london_greenspaces = greenspace_cover(polygons, greenspaces)

    accommodation_values: list[float] = []
    safety_values: list[float] = []
    population_values: list[float] = []
    positive_greenspace_values: list[float] = []

    for index, feature in enumerate(features):
        properties = feature["properties"]
        code = properties["code"]
        name = properties["name"]
        borough = properties["borough"]
        population = properties.get("population")
        area_km2 = polygons[index].area / 1_000_000
        prices = accommodation_prices.get(index, [])
        accommodation_median = round(statistics.median(prices), 2) if len(prices) >= 5 else None
        crime_count = crimes[properties["code"]]
        incident_rate = round(crime_count * 1_000 / population, 2) if population else None
        population_density = round(population / area_km2, 2) if population and area_km2 else None
        greenspace_percent = greenspace_percentages[index]

        properties.clear()
        properties.update(
            {
                "code": code,
                "name": name,
                "borough": borough,
                "areaKm2": round(area_km2, 3),
                "accommodationMedianPrice": accommodation_median,
                "accommodationSampleCount": len(prices),
                "accommodationLevel": None,
                "crimeCount": crime_count,
                "safetyIncidentRate": incident_rate,
                "safetyLevel": None,
                "population": population,
                "populationDensity": population_density,
                "populationLevel": None,
                "greenspacePercent": greenspace_percent,
                "greenspaceLevel": None,
            }
        )

        if accommodation_median is not None:
            accommodation_values.append(accommodation_median)
        if incident_rate is not None:
            safety_values.append(incident_rate)
        if population_density is not None:
            population_values.append(population_density)
        if greenspace_percent > 0:
            positive_greenspace_values.append(greenspace_percent)

    accommodation_breaks = quantile_breaks(accommodation_values, (0.2, 0.4, 0.6, 0.8))
    safety_breaks = quantile_breaks(safety_values, (0.2, 0.4, 0.6, 0.8))
    population_breaks = quantile_breaks(population_values, (0.2, 0.4, 0.6, 0.8))
    greenspace_breaks = quantile_breaks(positive_greenspace_values, (0.25, 0.5, 0.75))

    for feature in features:
        properties = feature["properties"]
        properties["accommodationLevel"] = level(properties["accommodationMedianPrice"], accommodation_breaks)
        properties["safetyLevel"] = level(properties["safetyIncidentRate"], safety_breaks)
        properties["populationLevel"] = level(properties["populationDensity"], population_breaks)
        properties["greenspaceLevel"] = (
            1
            if properties["greenspacePercent"] == 0
            else level(properties["greenspacePercent"], greenspace_breaks, offset=2)
        )

    collection["name"] = "London LSOA thematic indicators"
    collection["metadata"] = {
        "featureCount": len(features),
        "geography": "London LSOA 2021",
        "classification": "quantile",
        "indicators": {
            "accommodation": {
                "label": "Airbnb median total price",
                "unit": "dataset total price",
                "minimumSampleCount": 5,
                "snapshot": "unknown",
                "breaks": accommodation_breaks,
            },
            "safety": {
                "label": "annual recorded incidents per 1,000 residents",
                "period": "2024-01 to 2024-12",
                "populationYear": 2024,
                "breaks": safety_breaks,
            },
            "population": {
                "label": "residents per square kilometre",
                "year": 2024,
                "breaks": population_breaks,
            },
            "greenspace": {
                "label": "approximate public greenspace area share",
                "unit": "percent",
                "release": "2026-04",
                "breaks": greenspace_breaks,
            },
        },
        "quality": {
            "crime": crime_qa,
            "accommodation": accommodation_qa,
            "greenspace": {
                "sourceFeatureCount": source_greenspaces,
                "intersectedFeatureCount": london_greenspaces,
                "sourceTiles": [path.stem[:2].upper() for path in args.greenspace],
            },
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
