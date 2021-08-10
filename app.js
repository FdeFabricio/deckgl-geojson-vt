import React, {useEffect, useState} from "react";
import {render} from 'react-dom';
import DeckGL from '@deck.gl/react';
import {MVTLayer} from '@deck.gl/geo-layers';
import {StaticMap} from "react-map-gl";
import {GeoJsonLayer, PathLayer} from '@deck.gl/layers'
import geojsonvt from 'geojson-vt';
import {Matrix4} from 'math.gl';
import {COORDINATE_SYSTEM} from '@deck.gl/core';

const WORLD_SIZE = 512;
const DATA_URL = 'https://gist.githubusercontent.com/FdeFabricio/3d514770bfa3d784202ebb027810d538/raw/e30a9fee37d7f91aa8c829c313ab577dfcb63566/trips-v7-geojson.json';
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json';
const INITIAL_VIEW_STATE = {
    longitude: -74,
    latitude: 40.72,
    zoom: 13,
    minZoom: 0,
    maxZoom: 23,
};

const EXTENT = 4096;
const MAX_ZOOM = 23;

function vectorTileToGeoJSON(tile) {
    const result = [];
    for (const feature of tile.features) {
        result.push(featureToGeoJSON(feature));
    }
    return result;
}

function featureToGeoJSON(feature) {
    const types = ['Unknown', 'Point', 'LineString', 'Polygon'];
    let type = types[feature.type];
    let geometry = feature.geometry;

    if (geometry.length === 1) {
        geometry = geometry[0];
    } else {
        type = `Multi${type}`;
    }

    return {
        type: "Feature",
        geometry: {
            type,
            coordinates: geometry
        },
        properties: feature.tags
    };
}

export default function App({data_url = DATA_URL}) {
    const [tileIndex, setTileIndex] = useState(null);
    const loadTileIndex = async () => {
        fetch(data_url).then(r => r.json()).then(d => {
            const index = geojsonvt(d, {extent: EXTENT, maxZoom: MAX_ZOOM});
            setTileIndex(index);
        });
    };

    const fetchData = (url) => {
        let _url = url.split("/");
        const x = parseInt(_url[0]);
        const y = parseInt(_url[1]);
        const z = parseInt(_url[2]);
        return getTileData({x, y, z});
    }

    const getTileData = (tile) => {
        if (tileIndex) {
            const tileData = tileIndex.getTile(tile.z, tile.x, tile.y);
            if (tileData) {
                return vectorTileToGeoJSON(tileData);
            }
        }
        return null;
    }

    const layer = new MVTLayer({
        id: 'mvt-layer',
        data: "{x}/{y}/{z}",
        fetch: fetchData,
        renderSubLayers: props => {
            const {tile} = props;
            const {bbox: {west, south, east, north}} = tile;

            const worldScale = Math.pow(2, tile.z);
            const xScale = WORLD_SIZE / worldScale / EXTENT;
            const yScale = -xScale;
            const xOffset = (WORLD_SIZE * tile.x) / worldScale;
            const yOffset = WORLD_SIZE * (1 - tile.y / worldScale);

            props.modelMatrix = new Matrix4().scale([xScale, yScale, 1]);
            props.coordinateOrigin = [xOffset, yOffset, 0];
            props.coordinateSystem = COORDINATE_SYSTEM.CARTESIAN;
            props.extensions = [];

            return [
                new GeoJsonLayer({...props, lineWidthMinPixels: 5, getLineColor: [0, 0, 255]}),
                new PathLayer({
                    id: `${props.id}-border`,
                    data: [[[west, north], [west, south], [east, south], [east, north], [west, north]]],
                    getPath: d => d,
                    getColor: [255, 0, 0],
                    widthMinPixels: 1,
                })
            ];
        }
    });

    useEffect(() => {
        loadTileIndex();
        return () => {
        };
    }, []);

    return (
        <DeckGL
            layers={[tileIndex && layer]}
            initialViewState={INITIAL_VIEW_STATE}
            controller={true}
        >
            <StaticMap mapStyle={MAP_STYLE}/>
        </DeckGL>
    );
}

export function renderToDOM(container) {
    render(<App/>, container);
}
