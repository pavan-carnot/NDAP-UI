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
  const mapRef = React.useRef<any>(null);

  const datasetId = `${sourceFile}::${metric}`;

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
        // If focusStates is only "India" (or empty after filtering), fetch all states
        const statesForApi = focusStates
          ?.filter(s => s.toLowerCase().trim() !== "india");
        const data = await getMapData(datasetId, statesForApi?.length ? statesForApi : undefined);
        setMapData(data);
      } catch (err) {
        console.error("Failed to load map data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [isOpen, datasetId, focusStates]);

  const { enrichedGeoJson, maxValue } = useMemo(() => {
    if (!geoJsonData) return { enrichedGeoJson: null, maxValue: 1 };

    let max = 0;
    const dataLookup: Record<string, MapDataPoint> = {};
    mapData.forEach(d => {
      let normalized = d.location.toLowerCase().trim();
      if (normalized === "a&n island") normalized = "andaman & nicobar";
      if (normalized === "j&k") normalized = "jammu & kashmir";
      if (normalized === "d&n haveli") normalized = "dadra and nagar haveli and daman and diu";
      dataLookup[normalized] = d;
      if (d.value > max) max = d.value;
    });

    const enriched = JSON.parse(JSON.stringify(geoJsonData));

    let normalizedFocus: string[] = [];
    if (focusStates) {
      const fStates = Array.isArray(focusStates) ? focusStates : [focusStates];
      if (fStates.length > 0) {
        normalizedFocus = fStates.map(s => String(s).toLowerCase().trim()).filter(s => s !== "india");
      }
    }

    enriched.features.forEach((feature: any) => {
      const stateName = feature.properties.ST_NM;
      const normalizedStateName = stateName.toLowerCase().trim();

      let isFocused = true;
      if (normalizedFocus.length > 0) {
        isFocused =
          normalizedFocus.includes(normalizedStateName) ||
          (normalizedFocus.includes("andaman and nicobar") && normalizedStateName === "a&n island") ||
          (normalizedFocus.includes("jammu and kashmir") && normalizedStateName === "j&k");
      }

      const pointData = dataLookup[normalizedStateName];
      if (pointData && isFocused) {
        feature.properties.value = pointData.value;
        feature.properties.unit = pointData.unit;
      } else {
        feature.properties.value = null;
      }
    });

    return { enrichedGeoJson: enriched, maxValue: max || 1 };
  }, [geoJsonData, mapData, focusStates]);

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
        onClick={() => setIsOpen(!isOpen)}
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
