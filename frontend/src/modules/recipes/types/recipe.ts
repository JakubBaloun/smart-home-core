export type IngredientUnit =
  | 'G'
  | 'KG'
  | 'ML'
  | 'L'
  | 'TSP'
  | 'TBSP'
  | 'CUP'
  | 'FL_OZ'
  | 'OZ'
  | 'LB'
  | 'PINCH'

export interface Tag {
  id: number
  name: string
}

export interface RecipeIngredient {
  id: number
  name: string
  amount: number
  unit: IngredientUnit | null
  sortOrder: number
}

export interface RecipeStep {
  id: number
  stepNumber: number
  title: string | null
  content: string
  timerSeconds: number | null
}

export interface Recipe {
  id: number
  title: string
  servingsBase: number
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  tags: Tag[]
}

export interface RecipeDetail {
  id: number
  title: string
  description: string | null
  servingsBase: number
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  notes: string | null
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  tags: Tag[]
  createdAt: string
  updatedAt: string
}

export interface IngredientInput {
  name: string
  amount: number
  unit: IngredientUnit | null
}

export interface StepInput {
  title: string | null
  content: string
  timerSeconds: number | null
}

export interface RecipeRequest {
  title: string
  description: string | null
  servingsBase: number | null
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  notes: string | null
  ingredients: IngredientInput[]
  steps: StepInput[]
  tags: string[]
}

export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
