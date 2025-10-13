export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          username: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string
          created_at?: string
          updated_at?: string
        }
      }
      genres: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          owner_id: string
          title: string
          description: string
          genre_id: string | null
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          description: string
          genre_id?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          description?: string
          genre_id?: string | null
          tags?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      lesson_files: {
        Row: {
          id: string
          lesson_id: string
          filename: string
          file_type: string
          file_size: number
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          filename: string
          file_type: string
          file_size: number
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          filename?: string
          file_type?: string
          file_size?: number
          storage_path?: string
          uploaded_at?: string
        }
      }
      lesson_shares: {
        Row: {
          id: string
          lesson_id: string
          owner_id: string
          shared_with_id: string
          shared_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          owner_id: string
          shared_with_id: string
          shared_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          owner_id?: string
          shared_with_id?: string
          shared_at?: string
        }
      }
    }
  }
}
