import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { tileLayer, Map, LayerGroup, geoJSON, canvas } from 'leaflet';
import { DataService } from '../../services/data.service';
import * as h3 from 'h3-js';
import { Subscription, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import * as GeoJSONType from 'geojson';

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
    this.map = new Map('map', {renderer: canvas()}).setView([0, 0], 2);
    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);
    this.hexLayer.addTo(this.map);
  }

  private loadData(): void {
    this.dataSubscription = this.dataService.getProcessedData().subscribe(
      data => {
        data.features.forEach((feature: any) => {
          if (feature.geometry.type === 'MultiPolygon') {
            feature.geometry.coordinates.forEach((polygon: any) => {
              polygon.forEach((ring: any) => {
                ring.forEach((coord: number[]) => {
                  const [lng, lat] = coord;
                  const resolution = this.getH3Resolution(this.map.getZoom());
                  const h3Index = h3.geoToH3(lat, lng, resolution);
                  this.h3ColorMap[h3Index] = `#${feature.properties.COLOR_HEX}`;
                });
              });
            });
          } else if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates.forEach((ring: any) => {
              ring.forEach((coord: number[]) => {
                const [lng, lat] = coord;
                const resolution = this.getH3Resolution(this.map.getZoom());
                const h3Index = h3.geoToH3(lat, lng, resolution);
                this.h3ColorMap[h3Index] = `#${feature.properties.COLOR_HEX}`;
              });
            });
          }
        });
        this.renderHexagons();
      },
      error => {
        console.error('Error loading data:', error);
      }
    );
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
    const resolution = this.getH3Resolution(this.map.getZoom());

    const features: GeoJSONType.Feature<GeoJSONType.Polygon, any>[] = [];

    Object.keys(this.h3ColorMap).forEach(h3Index => {
      const [lat, lng] = h3.h3ToGeo(h3Index);
      if (bounds.contains([lat, lng])) {
        const boundary = h3.h3ToGeoBoundary(h3Index, true);
        const latLngs: [number, number][] = [];

        boundary.forEach(coord => {
          const [lngCoord, latCoord] = [coord[1], coord[0]];
          if (this.isValidCoordinate([lngCoord, latCoord])) {
            latLngs.push([lngCoord, latCoord]);
          } else {
            console.warn('Invalid coordinate encountered:', [lngCoord, latCoord]);
          }
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
        fillOpacity: 0.6
      }),
    }).addTo(this.hexLayer);
  }

  private getH3Resolution(zoom: number): number {
    if (zoom >= 18) return 12;
    if (zoom >= 16) return 11;
    if (zoom >= 14) return 10;
    if (zoom >= 12) return 9;
    if (zoom >= 10) return 8;
    return 7;
  }

  private isValidCoordinate(coord: [number, number]): boolean {
    const [lng, lat] = coord;
    return typeof lng === 'number' && typeof lat === 'number' && isFinite(lng) && isFinite(lat);
  }
}
