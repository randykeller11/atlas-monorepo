import { z } from 'zod';

export const PersonaCardSchema = z.object({
  archetypeName: z.string().min(1, "Archetype name is required"),
  shortDescription: z.string().min(10, "Description must be at least 10 characters"),
  elevatorPitch: z.string().min(20, "Elevator pitch must be at least 20 characters"),
  topStrengths: z.array(z.string()).min(3).max(6, "Must have 3-6 top strengths"),
  suggestedRoles: z.array(z.string()).min(3).max(8, "Must have 3-8 suggested roles"),
  nextSteps: z.array(z.string()).min(3).max(5, "Must have 3-5 next steps"),
  motivationalInsight: z.string().min(20).max(200, "Insight must be 20-200 characters")
});

export const EnrichedPersonaCardSchema = PersonaCardSchema.extend({
  id: z.string().uuid(),
  sessionId: z.string(),
  basePersona: z.object({
    key: z.string(),
    name: z.string(),
    confidence: z.number().min(0).max(1)
  }),
  assessmentAnchors: z.array(z.string()),
  createdAt: z.string().datetime(),
  version: z.string().default("1.0")
});

// Validation helper
export function validatePersonaCard(data) {
  try {
    return {
      success: true,
      data: PersonaCardSchema.parse(data)
    };
  } catch (error) {
    return {
      success: false,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }))
    };
  }
}
