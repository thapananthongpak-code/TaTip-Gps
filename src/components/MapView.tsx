import { USE_GOOGLE } from '@/services'
import { GoogleMapView, type MapViewProps } from './GoogleMapView'
import { LeafletMapView } from './LeafletMapView'

/**
 * เลือกผู้ให้บริการแผนที่ตามการตั้งค่า โดยที่ส่วนอื่นของแอปไม่ต้องรู้ว่าใช้เจ้าไหน
 *
 * ต้องเปลี่ยนพร้อมกับการค้นหาและเส้นทางเสมอ ไม่ใช่เลือกแยกกันได้
 * เพราะข้อกำหนดของ Google ห้ามเอาข้อมูล Places/Routes ไปแสดงบนแผนที่ที่ไม่ใช่ Google Maps
 * การผูกทั้งชุดไว้กับธงเดียวจึงทำให้ตั้งค่าผิดจนละเมิดข้อกำหนดไม่ได้ตั้งแต่ต้น
 */
export function MapView(props: MapViewProps) {
  return USE_GOOGLE ? <GoogleMapView {...props} /> : <LeafletMapView {...props} />
}

export type { MapViewProps }
