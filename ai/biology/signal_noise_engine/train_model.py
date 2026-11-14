"""Train the Signal vs. Noise multi-hazard biodosimetry classifier.

Distinguishes ionizing space radiation (HZE / SPE) from physiological noise
caused by microgravity fluid shifts or sleep/psychological stress, using
physical dosimetry + astronaut vitals + molecular biomarkers.
"""

import hashlib
from pathlib import Path
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from schemas import PrimaryCause, ShieldingType

SHIELDING_MAP = {
    ShieldingType.EVA_SUIT.value: 0,
    ShieldingType.CREW_CABIN_NOMINAL.value: 1,
    ShieldingType.STORM_SHELTER.value: 2,
}

FEATURE_NAMES = [
    "log10_dose_rate",
    "storm_scale_level",
    "shielding_code",
    "heart_rate_bpm",
    "systolic_mmhg",
    "diastolic_mmhg",
    "glucose_mg_dl",
    "temperature_c",
    "spo2_pct",
    "sleep_hours",
    "mood",
    "gamma_h2ax_foci",
    "urine_8ohdg_ng_mg",
    "fdxr_fold_change",
]

CLASSES = [
    PrimaryCause.NOMINAL.value,
    PrimaryCause.IONIZING_RADIATION.value,
    PrimaryCause.MICROGRAVITY_STRESS.value,
    PrimaryCause.SLEEP_PSYCH_STRESS.value,
]

MODEL_PATH = Path(__file__).parent / "model" / "signal_noise_model.joblib"


def extract_features(sample: dict) -> np.ndarray:
    dose = max(float(sample.get("doseRateMicroSvPerHour", 25.0)), 0.1)
    shielding = sample.get("shieldingType", ShieldingType.CREW_CABIN_NOMINAL.value)
    if isinstance(shielding, ShieldingType):
        shielding = shielding.value
    return np.array(
        [
            np.log10(dose + 1.0),
            float(sample.get("stormScaleLevel", 0)),
            float(SHIELDING_MAP.get(shielding, 1)),
            float(sample.get("heartRateBpm", 72.0)),
            float(sample.get("systolicMmHg", 118.0)),
            float(sample.get("diastolicMmHg", 76.0)),
            float(sample.get("glucoseMgDl", 95.0)),
            float(sample.get("temperatureC", 36.8)),
            float(sample.get("spo2Pct", 98.0)),
            float(sample.get("sleepHours", 7.5)),
            float(sample.get("mood", 4)),
            float(sample.get("gammaH2axFociPerCell", 0.8)),
            float(sample.get("urine8OhdgNgMg", 12.0)),
            float(sample.get("fdxrFoldChange", 1.0)),
        ],
        dtype=np.float64,
    )


def generate_calibrated_dataset(n_per_class: int = 800, seed: int = 42):
    """Generate a synthetic multi-hazard dataset calibrated to NASA HRP & biodosimetry ranges."""
    rng = np.random.default_rng(seed)
    X_rows = []
    y_rows = []

    for label in CLASSES:
        for _ in range(n_per_class):
            if label == PrimaryCause.NOMINAL.value:
                dose = rng.uniform(5.0, 60.0)
                storm = rng.choice([0, 1], p=[0.85, 0.15])
                shielding = rng.choice(list(SHIELDING_MAP.keys()), p=[0.1, 0.7, 0.2])
                hr = rng.normal(70.0, 6.0)
                sbp = rng.normal(118.0, 7.0)
                dbp = rng.normal(76.0, 5.0)
                glu = rng.normal(92.0, 8.0)
                temp = rng.normal(36.7, 0.2)
                spo2 = rng.normal(98.2, 0.6)
                sleep = rng.normal(7.5, 0.6)
                mood = int(rng.choice([4, 5], p=[0.5, 0.5]))
                h2ax = rng.normal(0.8, 0.25)
                ohdg = rng.normal(11.5, 2.5)
                fdxr = rng.normal(1.0, 0.18)

            elif label == PrimaryCause.IONIZING_RADIATION.value:
                storm = int(rng.choice([2, 3, 4, 5], p=[0.2, 0.35, 0.3, 0.15]))
                shielding = rng.choice(list(SHIELDING_MAP.keys()), p=[0.5, 0.4, 0.1])
                base_dose = {2: 450.0, 3: 3200.0, 4: 18000.0, 5: 45000.0}[storm]
                atten = {
                    "EVA_SUIT": 1.0,
                    "CREW_CABIN_NOMINAL": 0.28,
                    "STORM_SHELTER": 0.08,
                }[shielding]
                dose = max(120.0, base_dose * atten * rng.uniform(0.7, 1.35))
                hr = rng.normal(86.0, 10.0)
                sbp = rng.normal(124.0, 9.0)
                dbp = rng.normal(80.0, 6.0)
                glu = rng.normal(104.0, 12.0)
                temp = rng.normal(37.2, 0.35)
                spo2 = rng.normal(96.8, 1.0)
                sleep = rng.normal(6.5, 1.0)
                mood = int(rng.choice([2, 3, 4], p=[0.4, 0.4, 0.2]))
                # Radiation-specific signature: clustered DSBs (gamma-H2AX) + FDXR + 8-OHdG
                h2ax = rng.normal(4.5 + 0.00018 * dose, 1.1)
                ohdg = rng.normal(32.0 + 0.0008 * dose, 7.0)
                fdxr = rng.normal(3.8 + 0.00012 * dose, 0.9)

            elif label == PrimaryCause.MICROGRAVITY_STRESS.value:
                dose = rng.uniform(10.0, 80.0)
                storm = int(rng.choice([0, 1], p=[0.8, 0.2]))
                shielding = rng.choice(list(SHIELDING_MAP.keys()), p=[0.15, 0.7, 0.15])
                # Cephalic fluid shift + cardiovascular deconditioning
                hr = rng.normal(88.0, 8.0)
                sbp = rng.normal(134.0, 9.0)
                dbp = rng.normal(86.0, 6.0)
                glu = rng.normal(105.0, 10.0)
                temp = rng.normal(36.9, 0.25)
                spo2 = rng.normal(96.5, 1.0)
                sleep = rng.normal(6.8, 0.7)
                mood = int(rng.choice([3, 4], p=[0.6, 0.4]))
                # Mild oxidative stress (8-OHdG) WITHOUT HZE DNA DSB signature
                h2ax = rng.normal(1.05, 0.3)
                ohdg = rng.normal(25.0, 4.5)
                fdxr = rng.normal(1.2, 0.25)

            else:  # SLEEP_PSYCH_STRESS
                dose = rng.uniform(8.0, 65.0)
                storm = int(rng.choice([0, 1], p=[0.85, 0.15]))
                shielding = rng.choice(list(SHIELDING_MAP.keys()), p=[0.1, 0.75, 0.15])
                hr = rng.normal(84.0, 9.0)
                sbp = rng.normal(128.0, 8.0)
                dbp = rng.normal(82.0, 6.0)
                glu = rng.normal(112.0, 12.0)
                temp = rng.normal(36.8, 0.2)
                spo2 = rng.normal(97.5, 0.8)
                sleep = rng.uniform(2.5, 5.2)
                mood = int(rng.choice([1, 2], p=[0.55, 0.45]))
                # High 8-OHdG from sleep deprivation/cortisol, but normal gamma-H2AX and FDXR
                h2ax = rng.normal(0.95, 0.28)
                ohdg = rng.normal(28.5, 5.0)
                fdxr = rng.normal(1.15, 0.22)

            sample = {
                "doseRateMicroSvPerHour": float(np.clip(dose, 0.5, 100000.0)),
                "stormScaleLevel": int(storm),
                "shieldingType": shielding,
                "heartRateBpm": float(np.clip(hr, 45.0, 160.0)),
                "systolicMmHg": float(np.clip(sbp, 85.0, 190.0)),
                "diastolicMmHg": float(np.clip(dbp, 50.0, 120.0)),
                "glucoseMgDl": float(np.clip(glu, 65.0, 220.0)),
                "temperatureC": float(np.clip(temp, 35.5, 39.5)),
                "spo2Pct": float(np.clip(spo2, 88.0, 100.0)),
                "sleepHours": float(np.clip(sleep, 1.0, 12.0)),
                "mood": int(np.clip(mood, 1, 5)),
                "gammaH2axFociPerCell": float(np.clip(h2ax, 0.1, 35.0)),
                "urine8OhdgNgMg": float(np.clip(ohdg, 3.0, 150.0)),
                "fdxrFoldChange": float(np.clip(fdxr, 0.5, 20.0)),
            }
            X_rows.append(extract_features(sample))
            y_rows.append(label)

    return np.vstack(X_rows), np.array(y_rows)


def train_and_save() -> Pipeline:
    X, y = generate_calibrated_dataset(n_per_class=800, seed=42)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=200,
                    max_depth=12,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )

    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5)
    print(f"5-fold CV accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)
    print("\nTest Set Classification Report:")
    print(classification_report(y_test, y_pred, digits=4))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred, labels=CLASSES))

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "classes": CLASSES, "features": FEATURE_NAMES}, MODEL_PATH)
    digest = hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()
    Path(f"{MODEL_PATH}.sha256").write_text(f"{digest}  {MODEL_PATH.name}\n", encoding="utf-8")
    print(f"\nSaved model artifact to {MODEL_PATH} (sha256={digest})")
    return pipeline


if __name__ == "__main__":
    train_and_save()
