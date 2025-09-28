declare module 'cloudinary' {
  // Stub mínimo para permitir compilar antes de instalar los tipos reales
  export interface ConfigOptions {
    cloud_name?: string;
    api_key?: string;
    api_secret?: string;
    secure?: boolean;
  }
  export const v2: any;
  export default v2;
}
