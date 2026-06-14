"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Map, { Source, Layer, Popup, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapData, MapDataPoint } from "@/lib/api";

export default function InlineMap({
  sourceFile,
  metric,
  focusStates,
}: {
  sourceFile: string;
  metric: string;
  focusStates?: string[];
}) {
  const [mapData, setMapData] = useState<MapDataPoint[]>([]);
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = React.useRef<any>(null);

  const datasetId = `${sourceFile}::${metric}`;

  // Expand regional aliases to individual states
  const expandedFocusStates = useMemo(() => {
    if (!focusStates) return undefined;
    const fStates = Array.isArray(focusStates) ? focusStates : [focusStates];
    if (fStates.length === 0) return undefined;
    return fStates.flatMap(s => {
      const str = String(s).toLowerCase().trim();
      if (str.includes("north east") || str.includes("northeast"))
        return ["arunachal pradesh", "assam", "manipur", "meghalaya", "mizoram", "nagaland", "tripura", "sikkim"];
      if (str.includes("south india") || str.includes("southern states"))
        return ["andhra pradesh", "karnataka", "kerala", "tamil nadu", "telangana", "puducherry"];
      return [str];
    }).filter(s => s !== "india");
  }, [focusStates]);

  const [hoverInfo, setHoverInfo] = useState<{
    longitude: number;
    latitude: number;
    stateName: string;
    value: number | null;
    unit: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    async function fetchGeoJson() {
      try {
        const res = await fetch("/assets/india_states.geojson");
        const data = await res.json();
        setGeoJsonData(data);
      } catch (err) {
        console.error("Failed to load geojson:", err);
      }
    }
    fetchGeoJson();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    async function fetchData() {
      setLoading(true);
      try {
        // Always fetch all states — frontend handles focus/grey rendering to avoid case-mismatch issues with API filter
        const data = await getMapData(datasetId);
        setMapData(data);
      } catch (err) {
        console.error("Failed to load map data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isOpen, datasetId]);

  const { enrichedGeoJson, maxValue, focusBbox } = useMemo(() => {
    if (!geoJsonData) return { enrichedGeoJson: null, maxValue: 1, focusBbox: null };

    let max = 0;
    const dataLookup: Record<string, MapDataPoint> = {};
    const stateAliases: Record<string, string> = {
      "a&n island": "andaman and nicobar islands",
      "andaman & nicobar": "andaman and nicobar islands",
      "andaman and nicobar": "andaman and nicobar islands",
      "j&k": "jammu and kashmir",
      "jammu & kashmir": "jammu and kashmir",
      "d&n haveli": "dadra and nagar haveli",
      "dadra and nagar haveli and daman and diu": "dadra and nagar haveli",
      "daman & diu": "daman and diu",
      "orissa": "odisha",
      "uttaranchal": "uttarakhand",
      "pondicherry": "puducherry",
      "nct of delhi": "delhi",
      "chattisgarh": "chhattisgarh",
    };
    mapData.forEach(d => {
      const raw = d.location.toLowerCase().trim();
      const normalized = stateAliases[raw] ?? raw;
      dataLookup[normalized] = d;
      if (d.value > max) max = d.value;
    });

    const enriched = JSON.parse(JSON.stringify(geoJsonData));
    const normalizedFocus = expandedFocusStates ?? [];

    // Accumulate bbox of focused features for auto-zoom
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

    enriched.features.forEach((feature: any) => {
      const stateName = feature.properties.ST_NM;
      const normalizedStateName = stateName.toLowerCase().trim();

      let isFocused = true;
      if (normalizedFocus.length > 0) {
        isFocused = normalizedFocus.includes(normalizedStateName);
      }

      const pointData = dataLookup[normalizedStateName];
      if (pointData && isFocused) {
        feature.properties.value = pointData.value;
        feature.properties.unit = pointData.unit;
      } else {
        feature.properties.value = null;
      }

      // Collect bbox coords for focused states
      if (isFocused && normalizedFocus.length > 0) {
        const geom = feature.geometry;
        const rings: number[][][] =
          geom?.type === "Polygon" ? geom.coordinates :
          geom?.type === "MultiPolygon" ? geom.coordinates.flat() : [];
        rings.forEach((ring: number[][]) => {
          ring.forEach(([lng, lat]: number[]) => {
            if (lng < minLng) minLng = lng;
            if (lat < minLat) minLat = lat;
            if (lng > maxLng) maxLng = lng;
            if (lat > maxLat) maxLat = lat;
          });
        });
      }
    });

    const bbox =
      normalizedFocus.length > 0 && isFinite(minLng)
        ? ([[minLng, minLat], [maxLng, maxLat]] as [[number, number], [number, number]])
        : null;

    return { enrichedGeoJson: enriched, maxValue: max || 1, focusBbox: bbox };
  }, [geoJsonData, mapData, expandedFocusStates]);

  // Auto-zoom: call fitBounds when BOTH map is loaded AND bbox is ready
  const applyFocusBbox = useCallback(() => {
    if (!focusBbox || !mapRef.current) return;
    mapRef.current.fitBounds(focusBbox, { padding: 40, duration: 600 });
  }, [focusBbox]);

  useEffect(() => {
    if (mapLoaded) applyFocusBbox();
  }, [mapLoaded, applyFocusBbox]);

  const stateLayerStyle = {
    id: "states-fill",
    type: "fill" as const,
    paint: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "fill-color": [
        "case",
        ["==", ["get", "value"], null],
        "#f3f4f6",
        ["interpolate", ["linear"], ["get", "value"], 0, "#fee2e2", maxValue, "#991b1b"],
      ] as any,
      "fill-opacity": 0.8,
      "fill-outline-color": "#ffffff",
    },
  };

  const stateLineStyle = {
    id: "states-line",
    type: "line" as const,
    paint: {
      "line-color": "#ffffff",
      "line-width": 1,
      "line-opacity": 0.5,
    },
  };

  const onHover = useCallback((event: any) => {
    const { features, lngLat: { lng, lat } } = event;
    const hoveredFeature = features && features[0];
    if (hoveredFeature) {
      setHoverInfo({
        longitude: lng,
        latitude: lat,
        stateName: hoveredFeature.properties.ST_NM,
        value: hoveredFeature.properties.value,
        unit: hoveredFeature.properties.unit || "",
      });
    } else {
      setHoverInfo(null);
    }
  }, []);

  return (
    <div className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm text-sm">
      <button
        onClick={() => { setIsOpen(o => !o); setMapLoaded(false); }}
        className="w-full px-4 py-2 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left font-medium text-gray-700 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-lg">🗺️</span>
          View Map: {metric.replace(/_/g, " ")}
          <span className="text-xs text-gray-500 font-normal">({sourceFile})</span>
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="relative h-[300px] bg-gray-50 border-t border-gray-200">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <span className="text-sm font-medium text-gray-500">Loading map data…</span>
            </div>
          )}
          <Map
            ref={mapRef}
            initialViewState={{ longitude: 78.9629, latitude: 22.5, zoom: 3 }}
            mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
            interactiveLayerIds={["states-fill"]}
            onMouseMove={onHover}
            onMouseLeave={() => setHoverInfo(null)}
            onLoad={() => { setMapLoaded(true); applyFocusBbox(); }}
          >
            <NavigationControl position="bottom-right" />
            {enrichedGeoJson && (
              <Source id={`inline-india-${datasetId}`} type="geojson" data={enrichedGeoJson}>
                <Layer {...stateLayerStyle} />
                <Layer {...stateLineStyle} />
              </Source>
            )}
            {hoverInfo && (
              <Popup
                longitude={hoverInfo.longitude}
                latitude={hoverInfo.latitude}
                anchor="bottom"
                closeButton={false}
                closeOnClick={false}
                className="z-50 pointer-events-none"
                offset={10}
              >
                <div className="p-1 w-32 text-center text-xs">
                  <h3 className="font-bold text-gray-900 mb-0.5">{hoverInfo.stateName}</h3>
                  {typeof hoverInfo.value === "number" ? (
                    <div className="text-sm font-bold text-red-700">
                      {hoverInfo.value.toLocaleString()}{" "}
                      <span className="font-normal text-gray-500">{hoverInfo.unit}</span>
                    </div>
                  ) : (
                    <div className="text-gray-500 italic">No data</div>
                  )}
                </div>
              </Popup>
            )}
          </Map>
        </div>
      )}
    </div>
  );
}
