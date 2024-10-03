import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { tileLayer, Map, LayerGroup, geoJSON, canvas, CRS } from 'leaflet';
import { DataService } from '../../services/data.service';
import * as h3 from 'h3-js';
import * as geojson2h3 from 'geojson2h3';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, delay } from 'rxjs/operators';
import * as GeoJSONType from 'geojson';

const H3RESOLUTION = 5;

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: 'map.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapComponent implements OnInit, OnDestroy {
  private map!: Map;
  private hexLayer = new LayerGroup();
  private dataSubscription!: Subscription;
  private mapEvents$ = new Subject<void>();
  private h3ColorMap: { [key: string]: string } = {};

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.initMap();
    this.loadData();
    this.setupMapEvents();
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) this.dataSubscription.unsubscribe();
    this.map.off();
    this.map.remove();
  }

  private initMap(): void {
    this.map = new Map('map', { renderer: canvas() }).setView([0, 0], 2);
    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
      minZoom: 0,
    }).addTo(this.map);   

    this.hexLayer.addTo(this.map);
  }

  private loadData(): void {
    this.dataSubscription = this.dataService.getProcessedData().subscribe(
      data => {
        this.mapFeatures(data.features);
        this.renderHexagons();
      },
      error => {
        console.error('Error loading data:', error);
      }
    );
  }

  private mapFeatures(features: any) {
    features.forEach((feature: any) => {
      const h3Indexes = geojson2h3.featureToH3Set(feature, H3RESOLUTION);

      h3Indexes.forEach((h3Index) => {
        this.h3ColorMap[h3Index] = `#${feature.properties.COLOR_HEX}`;
      });
    });
  }

  private setupMapEvents(): void {
    this.mapEvents$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.renderHexagons();
    });

    this.map.on('moveend zoomend', () => {
      this.mapEvents$.next();
    });
  }

  private renderHexagons(): void {
    this.hexLayer.clearLayers();
    const bounds = this.map.getBounds();

    const features: GeoJSONType.Feature<GeoJSONType.Polygon, any>[] = [];

    Object.keys(this.h3ColorMap).forEach(h3Index => {
      const [lat, lng] = h3.h3ToGeo(h3Index);
      if (bounds.contains([lng, lat])) {
        const boundary = h3.h3ToGeoBoundary(h3Index, true);
        const latLngs: [number, number][] = [];

        boundary.forEach(coord => {
          const [lngCoord, latCoord] = [coord[1], coord[0]];
          latLngs.push([lngCoord, latCoord]);
        });

        if (latLngs.length >= 3) {
          const feature: GeoJSONType.Feature<GeoJSONType.Polygon, any> = {
            type: 'Feature',
            properties: {
              color: this.h3ColorMap[h3Index]
            },
            geometry: {
              type: 'Polygon',
              coordinates: [latLngs]
            }
          };

          features.push(feature);
        }
      }
    });

    const geoJsonData: GeoJSONType.FeatureCollection<GeoJSONType.Polygon, any> = {
      type: 'FeatureCollection',
      features: features
    };

    geoJSON(geoJsonData, {
      style: (feature: any) => ({
        color: feature.properties.color,
        fillColor: feature.properties.color,
        fillOpacity: 0.5
      }),
    }).addTo(this.hexLayer);
  }
}
