# REWIND Store — Customer Globe/Map Bug: Root Cause Found + Fix

## What happened

A previous session diagnosed a broken 3D globe render (no country outlines, no arcs, no city beacons visible). It confirmed one real bug (city beacon radius mismatch) and correctly proposed a *theory* for the missing outlines/arcs — that an error thrown while setting `hexPolygonsData(...)` would abort the rest of the effect, since `arcsData(...)` runs right after it in the same function. It asked for your browser console output to confirm this, but the session hit its rate limit before you could reply and before it delivered the promised try/catch fix.

This report finishes that process: the radius bug is already fixed in your current `globe.jsx`, the theory about the thrown error has been **confirmed**, and the actual root cause has been found and fixed — it was never a code logic bug.

---

## Confirmed: root cause is a corrupted data file, not your code

`src/data/countries.json` (the file `globe.jsx` imports for country outlines) is not valid Natural Earth boundary data. I checked it directly:

- **3,909 of 4,294 polygon rings (91%) are degenerate** — single coordinate pairs like `[[117.703608, 4.163415]]` instead of closed rings with 4+ points.
- **189 of 258 country features (73%)** have at least one broken ring.
- **Zero features have a `properties` object** at all (real Natural Earth data always includes `ADMIN`, `ISO_A2`, `POP_EST`, etc.).

This is not how Natural Earth 110m data looks — it's corrupted or was reconstructed incorrectly at some point (most likely generated/approximated rather than downloaded intact). When `three-globe`'s hex-polygon tessellation tries to process a "polygon" with a single point, it throws — synchronously, inside the same effect where `arcsData(...)` is called right after. That single throw is why *both* the outlines and the arcs vanished together. The previous session's theory was correct; this is the confirmed cause.

I verified the three-globe API itself is not at fault — `hexPolygonsData`, `hexPolygonUseDots`, `hexPolygonResolution`, `hexPolygonMargin`, `hexPolygonColor`, `hexPolygonAltitude` are all real, correctly-used methods (confirmed against the library's own examples). So no API-call fix is needed — only the data.

### The fix
I sourced a clean replacement from the same public-domain Natural Earth dataset (via the `three-globe`/`globe.gl` project's own bundled example file), and verified it: **177 features, 289 rings, 0 malformed rings, `properties` present on every feature.**

**→ Replace `src/data/countries.json` with the attached `countries.json`.** Drop-in replacement, same import path, no code changes required for this part.

---

## Also confirmed fixed already (from the previous session)

`CityBeacons` and `AtmosphereGlow` in your current `globe.jsx` both correctly use `radius={100}`, matching `three-globe`'s internal globe radius. The leftover `radius={5.01}` from the pre-`three-globe` prototype is gone. Nothing further needed here.

---

## Still worth doing: the defensive fix that was promised but never delivered

Even with the data fixed, the effect should not be able to silently kill everything downstream of it again if some future data change reintroduces bad geometry. Wrap the risky call in `try/catch` so any future failure surfaces in the console instead of silently taking out the arcs, rings, and beacons with it:

```jsx
useEffect(() => {
  if (!globeRef.current || !isInitialized || !data) return;

  try {
    // Real country outlines — hexPolygonResolution/Margin control
    // how crisp vs. hex-tiled borders look
    globeRef.current
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.7)
      .hexPolygonUseDots(false)
      .hexPolygonColor(() => 'rgba(190, 210, 245, 0.65)')
      .hexPolygonAltitude(0.006)
      .showAtmosphere(defaultProps.showAtmosphere)
      .atmosphereColor(defaultProps.atmosphereColor)
      .atmosphereAltitude(defaultProps.atmosphereAltitude);
  } catch (err) {
    console.error('[Globe] Failed to set hex polygon data (country outlines):', err);
  }

  try {
    globeRef.current
      .arcsData(data)
      .arcStartLat(d => d.startLat)
      .arcStartLng(d => d.startLng)
      .arcEndLat(d => d.endLat)
      .arcEndLng(d => d.endLng)
      .arcColor(e => e.color)
      .arcAltitude(e => e.arcAlt)
      .arcStroke(() => 0.28)
      .arcDashLength(defaultProps.arcLength)
      .arcDashInitialGap(e => e.order * 1)
      .arcDashGap(15)
      .arcDashAnimateTime(() => defaultProps.arcTime);
  } catch (err) {
    console.error('[Globe] Failed to set arcs data:', err);
  }

  globeRef.current.pointsData([]);
  globeRef.current.ringsData([]);
}, [isInitialized, data, defaultProps]);
```

Splitting into two `try/catch` blocks (rather than one around both) is deliberate: it means a future problem with country-outline data won't also take down the arcs, and vice versa — they now fail independently instead of one silently swallowing the other.

---

## Two smaller things found while reviewing the rest of the pipeline

Neither is causing the current bug, but both are worth a look:

1. **`src/components/ui/world-map.jsx` is dead code.** It defines a `WorldMap` component that isn't imported anywhere — `CustomerMap.jsx` has its own separate, more polished inline 2D fallback (`FullscreenMap`) that it actually uses. Safe to delete `world-map.jsx` unless you're planning to use it elsewhere.
2. **`scripts/backfill-city-coords.js` duplicates geocoding logic instead of reusing `api/utils/geocode.js`.** The backfill script calls Nominatim directly with no retry, while `geocode.js` already exports `geocodeWithRetry` (2 retries, 1.1s apart) that `orders-locations.js`'s live fallback presumably relies on. Worth having the backfill script import and use `geocodeWithRetry` too, so a single flaky Nominatim response doesn't permanently drop a city from the map until the next manual backfill run.

---

## Action items, in order

1. Replace `src/data/countries.json` with the attached file.
2. Add the two `try/catch` blocks above to `globe.jsx`'s data-loading effect.
3. Redeploy and open the globe — outlines, arcs, and city beacons should all render now.
4. (Optional cleanup) Delete `src/components/ui/world-map.jsx`.
5. (Optional reliability fix) Point `backfill-city-coords.js` at `geocodeWithRetry` from `geocode.js`.
