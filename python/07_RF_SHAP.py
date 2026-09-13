# =====================================================================
#  Random Forest + SHAP analysis of LST drivers
#  Khulna, Bangladesh  |  Predictors: NDVI, NDBI, NDWI, SAVI  |  Target: LST
#
#  For each study year this script:
#    1. loads the per-pixel fishnet CSV (NDVI, NDBI, NDWI, SAVI, LST),
#    2. tunes a Random Forest with GridSearchCV (5-fold),
#    3. reports R2 / RMSE / MAE on a hold-out test set,
#    4. computes SHAP values and plots the SHAP summary + feature importance.
#
#  Requirements: pandas, numpy, matplotlib, scikit-learn, shap
#  Usage: set YEAR (or loop over YEARS) and the CSV path, then run.
# =====================================================================

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import shap
from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

plt.rcParams["font.family"] = "Times New Roman"

YEAR    = 1990
PREDS   = [f"NDVI_{YEAR}", f"NDBI_{YEAR}", f"NDWI_{YEAR}", f"SAVI_{YEAR}"]
TARGET  = f"LST_{YEAR}"
CSV     = f"{YEAR}.csv"
SEED    = 42

# ---- Load & clean ----
df = pd.read_csv(CSV)[PREDS + [TARGET]]
df = df.apply(pd.to_numeric, errors="coerce").replace([-9999, -9999.0], np.nan).dropna()
print("Rows after cleaning:", df.shape[0])

X = df[PREDS]
y = df[TARGET]

# ---- Train/test split ----
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=SEED)

# ---- Random Forest + GridSearchCV ----
param_grid = {
    "n_estimators":      [200, 500],
    "max_depth":         [10, 20],
    "min_samples_split": [2, 5],
    "min_samples_leaf":  [1, 2],
    "max_features":      ["sqrt"],
}
grid = GridSearchCV(RandomForestRegressor(random_state=SEED),
                    param_grid, cv=5, scoring="r2", n_jobs=-1, verbose=1)
grid.fit(X_train, y_train)
best = grid.best_estimator_
print("\nBest parameters:", grid.best_params_)

# ---- Evaluation (hold-out test set) ----
pred = best.predict(X_test)
print("\nModel performance (test set)")
print("R2  :", round(r2_score(y_test, pred), 3))
print("RMSE:", round(np.sqrt(mean_squared_error(y_test, pred)), 3))
print("MAE :", round(mean_absolute_error(y_test, pred), 3))

# ---- Cross-validated R2 on the TRAINING data (avoids leaking the test set) ----
cv = cross_val_score(best, X_train, y_train, cv=5, scoring="r2", n_jobs=-1)
print("CV R2 (train): mean =", round(cv.mean(), 3), " std =", round(cv.std(), 3))
# NOTE: spatially blocked cross-validation (a more conservative estimate that
# accounts for spatial autocorrelation) is provided in 08_diagnostics_VIF_spatialCV.

# ---- SHAP ----
X_sample = X.sample(n=min(2000, len(X)), random_state=SEED)
explainer = shap.TreeExplainer(best)
shap_values = explainer.shap_values(X_sample)

# SHAP summary plot
plt.figure(figsize=(10, 5))
shap.summary_plot(shap_values, X_sample, plot_type="dot", max_display=10, show=False)
plt.title("(a) SHAP summary plot", fontsize=14)
plt.subplots_adjust(left=0.25, right=0.95, top=0.90, bottom=0.15)
plt.tight_layout()
plt.savefig(f"SHAP_summary_{YEAR}.png", dpi=300, bbox_inches="tight")
plt.show()

# Feature-importance donut (mean |SHAP|)
importances = np.abs(shap_values).mean(axis=0)
labels = np.array([c.replace(f"_{YEAR}", "") for c in X.columns])
sizes = importances / importances.sum() * 100
order = np.argsort(sizes)[::-1]
sizes, labels = sizes[order], labels[order]

colors = ["#ff0051", "#b100ff", "#4f6df5", "#00bfa5"]
fig, ax = plt.subplots(figsize=(6, 6))
wedges, _ = ax.pie(sizes, colors=colors, startangle=90,
                   wedgeprops=dict(width=0.35, edgecolor="white"))
ax.add_artist(plt.Circle((0, 0), 0.65, fc="white"))
for i, w in enumerate(wedges):
    ang = np.deg2rad((w.theta2 + w.theta1) / 2)
    ax.text(0.4*np.cos(ang), 0.4*np.sin(ang),
            f"{labels[i]}\n{sizes[i]:.1f}%",
            ha="center", va="center", fontsize=11, fontname="Times New Roman")
ax.set_title("(b) Feature importance", fontsize=14, fontname="Times New Roman")
plt.tight_layout()
plt.savefig(f"SHAP_importance_{YEAR}.png", dpi=300, bbox_inches="tight")
plt.show()
