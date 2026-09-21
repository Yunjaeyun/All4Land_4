#!/usr/bin/env python3
"""Extract only London rows and map fields from the provided Kaggle dataset."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def integer(value: str, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def decimal(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    listings: list[dict[str, object]] = []
    with args.input.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            if (row.get("city") or "").strip() != "London":
                continue

            latitude = decimal(row.get("latitude") or "")
            longitude = decimal(row.get("longitude") or "")
            price_total = decimal(row.get("price_total") or "")
            if not latitude or not longitude or price_total <= 0:
                continue

            listings.append(
                {
                    "id": f"london-{len(listings) + 1:05d}",
                    "roomType": (row.get("room_type") or "Unknown").strip(),
                    "priceTotal": round(price_total, 2),
                    "maxGuests": integer(row.get("max_guests") or ""),
                    "bedrooms": integer(row.get("num_bedrooms") or ""),
                    "cleanlinessScore": decimal(row.get("cleanliness_score") or ""),
                    "satisfactionScore": decimal(row.get("guest_satisfaction_score") or ""),
                    "isSuperhost": row.get("is_superhost") == "1",
                    "distanceCityCenter": round(decimal(row.get("distance_city_center") or ""), 2),
                    "distanceMetro": round(decimal(row.get("distance_metro") or ""), 2),
                    "dayType": (row.get("day_type") or "").strip(),
                    "latitude": round(latitude, 5),
                    "longitude": round(longitude, 5),
                }
            )

    payload = {
        "metadata": {
            "source": "Kaggle: youssefkhaled117/airbnb",
            "priceUnit": "dataset total price",
            "listingCount": len(listings),
            "hasListingNames": False,
        },
        "listings": listings,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
