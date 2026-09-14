// tools/calculator.ts — Safe mathematical evaluation tool
// Enables deterministic calculations for agent workflows and validation.

import { PermissionLevel } from '@/lib/schemas';
import type { ToolDefinition } from '@/lib/schemas';
import { toolRegistry } from './registry';
import { logger } from '@/lib/logger';

const calculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Perform a mathematical calculation. Accepts arithmetic expressions like "12345 * 6789", "125 * 48", or "6000 - 6000".',
  parameters: [
    {
      name: 'expression',
      type: 'string',
      description: 'The mathematical expression to evaluate (e.g. "12345 * 6789" or "847 * 293")',
      required: true,
    },
  ],
  permission: PermissionLevel.READ,
  source: 'built-in',
};

function safeEvaluate(expr: string): number {
  // Sanitize: allow only numbers, whitespace, and basic arithmetic operators + - * / ( ) % .
  const clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '').trim();

  if (!/^[0-9+\-*/().\s%]+$/.test(clean)) {
    throw new Error(`Invalid mathematical expression: "${expr}" contains illegal characters.`);
  }

  // Safe evaluation using Function with no scope access
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${clean});`)();
  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error(`Calculation resulted in invalid number: ${result}`);
  }
  return result;
}

export function registerCalculatorTools(): void {
  toolRegistry.register(calculatorTool, async (args) => {
    try {
      const expression = String(args.expression || args.expr || '');
      if (!expression) {
        return { success: false, error: 'No expression provided for calculation' };
      }

      logger.info('CalculatorTool', `Calculating: ${expression}`);
      const value = safeEvaluate(expression);
      return {
        success: true,
        result: {
          expression,
          value,
          formatted: value.toLocaleString('en-US'),
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  // Also register with namespace "calculator.calculate" for compatibility
  toolRegistry.register(
    {
      ...calculatorTool,
      name: 'calculator.calculate',
    },
    async (args) => {
      try {
        const expression = String(args.expression || args.expr || '');
        if (!expression) {
          return { success: false, error: 'No expression provided' };
        }
        const value = safeEvaluate(expression);
        return {
          success: true,
          result: {
            expression,
            value,
            formatted: value.toLocaleString('en-US'),
          },
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  );
}
