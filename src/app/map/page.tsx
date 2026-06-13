"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Map, { Source, Layer, Popup, NavigationControl } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { getMapDatasets, getMapData, MapDataset, MapDataPoint } from "@/lib/api";

export default function MapPage() {
  const [datasets, setDatasets] = useState<MapDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [mapData, setMapData] = useState<MapDataPoint[]>([]);
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);

  const [hoverInfo, setHoverInfo] = useState<{
    longitude: number;
    latitude: number;
    stateName: string;
    value: number | null;
    unit: string;
  } | null>(null);

  useEffect(() => {
    async function fetchDatasets() {
      try {
        const data = await getMapDatasets();
        setDatasets(data);
        if (data.length > 0) setSelectedDatasetId(data[0].id);
      } catch (err) {
        console.error("Failed to load map datasets:", err);
      }
    }
    fetchDatasets();
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!selectedDatasetId) return;
    async function fetchData() {
      setLoading(true);
      try {
        const data = await getMapData(selectedDatasetId);
        setMapData(data);
      } catch (err) {
        console.error("Failed to load map data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [selectedDatasetId]);

  const selectedDataset = useMemo(
    () => datasets.find(d => d.id === selectedDatasetId),
    [datasets, selectedDatasetId]
  );

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
    enriched.features.forEach((feature: any) => {
      const stateName = feature.properties.ST_NM;
      const normalizedStateName = stateName.toLowerCase().trim();
      const pointData = dataLookup[normalizedStateName];
      if (pointData) {
        feature.properties.value = pointData.value;
        feature.properties.unit = pointData.unit;
      } else {
        feature.properties.value = null;
      }
    });

    return { enrichedGeoJson: enriched, maxValue: max || 1 };
  }, [geoJsonData, mapData]);

  const currentPalette = useMemo(() => {
    const colorPalettes = [
      { name: "Red",    light: "#fee2e2", dark: "#991b1b", classes: ["bg-red-100",    "bg-red-300",    "bg-red-500",    "bg-red-700",    "bg-[#991b1b]",  "text-red-700"]    },
      { name: "Indigo", light: "#e0e7ff", dark: "#3730a3", classes: ["bg-indigo-100", "bg-indigo-300", "bg-indigo-500", "bg-indigo-700", "bg-[#3730a3]",  "text-indigo-700"] },
      { name: "Green",  light: "#dcfce7", dark: "#166534", classes: ["bg-green-100",  "bg-green-300",  "bg-green-500",  "bg-green-700",  "bg-[#166534]",  "text-green-700"]  },
      { name: "Orange", light: "#ffedd5", dark: "#9a3412", classes: ["bg-orange-100", "bg-orange-300", "bg-orange-500", "bg-orange-700", "bg-[#9a3412]",  "text-orange-700"] },
      { name: "Purple", light: "#f3e8ff", dark: "#6b21a8", classes: ["bg-purple-100", "bg-purple-300", "bg-purple-500", "bg-purple-700", "bg-[#6b21a8]",  "text-purple-700"] },
      { name: "Teal",   light: "#ccfbf1", dark: "#115e59", classes: ["bg-teal-100",   "bg-teal-300",   "bg-teal-500",   "bg-teal-700",   "bg-[#115e59]",  "text-teal-700"]   },
    ];
    const index = selectedDatasetId
      ? selectedDatasetId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colorPalettes.length
      : 0;
    return colorPalettes[index];
  }, [selectedDatasetId]);

  const stateLayerStyle = useMemo(
    () => ({
      id: "states-fill",
      type: "fill" as const,
      paint: {
        "fill-color": [
          "case",
          ["==", ["get", "value"], null],
          "#f3f4f6",
          ["interpolate", ["linear"], ["get", "value"], 0, currentPalette.light, maxValue, currentPalette.dark],
        ],
        "fill-opacity": 0.8,
        "fill-outline-color": "#ffffff",
      },
    }),
    [maxValue, currentPalette]
  );

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
    <div className="flex flex-col h-[calc(100vh-130px)] bg-gray-50">
      {/* Control bar */}
      <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Spatial Analytics</h1>
          <p className="text-sm text-gray-500">Visualising data from ingested documents.</p>
        </div>
        <div className="flex items-center space-x-4">
          <label htmlFor="dataset-select" className="text-sm font-medium text-gray-700">
            Resource:
          </label>
          <select
            id="dataset-select"
            className="border-gray-300 rounded-md shadow-sm focus:border-ndap-primary focus:ring-ndap-primary sm:text-sm p-2 border max-w-lg"
            value={selectedDatasetId}
            onChange={e => setSelectedDatasetId(e.target.value)}
            disabled={loading}
          >
            {datasets.map(ds => (
              <option key={ds.id} value={ds.id}>
                {ds.description
                  ? ds.description.length > 80
                    ? ds.description.substring(0, 80) + "…"
                    : ds.description
                  : ds.metric.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          {loading && <span className="text-sm text-ndap-primary font-semibold">Loading…</span>}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          initialViewState={{ longitude: 78.9629, latitude: 20.5937, zoom: 4 }}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
          interactiveLayerIds={["states-fill"]}
          onMouseMove={onHover}
          onMouseLeave={() => setHoverInfo(null)}
        >
          <NavigationControl position="bottom-right" />

          {enrichedGeoJson && (
            <Source id="india-states" type="geojson" data={enrichedGeoJson}>
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
              offset={15}
            >
              <div className="p-2 w-48 text-center">
                <h3 className="font-bold text-gray-900 text-md mb-1">{hoverInfo.stateName}</h3>
                {typeof hoverInfo.value === "number" ? (
                  <div className={`text-xl font-bold ${currentPalette.classes[5]}`}>
                    {hoverInfo.value.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-gray-500">{hoverInfo.unit}</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">No data available</div>
                )}
              </div>
            </Popup>
          )}
        </Map>

        {/* Dataset info card */}
        {selectedDataset && (
          <div className="absolute top-6 left-6 w-80 bg-white/90 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-gray-200 z-10 pointer-events-none">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">
              {selectedDataset.metric.replace(/_/g, " ")}
            </h2>
            {selectedDataset.description && (
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">{selectedDataset.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{selectedDataset.source_file}</p>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-12 left-6 w-80 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-gray-200 z-10 pointer-events-none">
          <h4 className="font-semibold text-gray-800 text-sm mb-2">Value Intensity</h4>
          <div className="flex items-center space-x-1 mt-2">
            <span className="text-xs text-gray-600 mr-2">Low</span>
            {currentPalette.classes.slice(0, 5).map((cls, i) => (
              <div key={i} className={`w-6 h-4 ${cls} rounded-sm`} />
            ))}
            <span className="text-xs text-gray-600 ml-2">High ({maxValue.toLocaleString()})</span>
          </div>

          {mapData.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <h4 className="font-semibold text-gray-800 text-xs mb-2 uppercase tracking-wide">Quick Insights</h4>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Highest:</span>
                <span className="font-medium text-gray-900 text-right">
                  {mapData.reduce((p, c) => (c.value > p.value ? c : p)).location} (
                  {mapData.reduce((p, c) => (c.value > p.value ? c : p)).value.toLocaleString()})
                </span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Lowest:</span>
                <span className="font-medium text-gray-900 text-right">
                  {mapData.reduce((p, c) => (c.value < p.value ? c : p)).location} (
                  {mapData.reduce((p, c) => (c.value < p.value ? c : p)).value.toLocaleString()})
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Coverage:</span>
                <span className="font-medium text-gray-900">{mapData.length} States/UTs</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
