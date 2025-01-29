class ConversationContextManager {
  constructor() {
    this.sections = new Map();
    this.currentSection = null;
    this.metadata = new Map();
  }

  updateContext(response) {
    if (!response.section) return;
    
    const currentData = this.sections.get(response.section) || {
      questionCount: 0,
      lastQuestionType: null,
      responses: []
    };

    this.sections.set(response.section, {
      questionCount: currentData.questionCount + 1,
      lastQuestionType: response.type,
      responses: [...currentData.responses, response]
    });

    this.currentSection = response.section;
  }

  getSectionContext(section) {
    return this.sections.get(section) || {
      questionCount: 0,
      lastQuestionType: null,
      responses: []
    };
  }

  getMetadata(key) {
    return this.metadata.get(key);
  }

  setMetadata(key, value) {
    this.metadata.set(key, value);
  }
}

class ResponseSanitizer {
  constructor(rules) {
    this.rules = rules;
    this.fallbacks = new Map();
  }

  async sanitize(response, context) {
    try {
      for (const rule of this.rules) {
        const result = await rule.apply(response, context);
        if (!result.isValid) {
          return this.getFallback(rule.name, context);
        }
        response = result.response;
      }
      return response;
    } catch (error) {
      console.error('Sanitization error:', error);
      return this.getFallback('default', context);
    }
  }

  registerFallback(ruleType, fallbackFn) {
    this.fallbacks.set(ruleType, fallbackFn);
  }

  getFallback(ruleType, context) {
    const fallback = this.fallbacks.get(ruleType) || this.fallbacks.get('default');
    return fallback ? fallback(context) : this.defaultFallback(context);
  }

  defaultFallback(context) {
    return {
      type: 'text',
      content: 'I apologize, but I need to better understand your response. Could you please rephrase that?'
    };
  }
}

class ConversationStateMachine {
  constructor(rules) {
    this.currentState = 'initial';
    this.transitions = new Map();
    this.rules = rules;
  }

  async transition(input, context) {
    const possibleTransitions = this.transitions.get(this.currentState) || [];
    const nextState = possibleTransitions.find(t => t.condition(input, context));
    
    if (nextState) {
      try {
        await this.rules[nextState].validate(input, context);
        this.currentState = nextState;
        return true;
      } catch (error) {
        console.error('State transition validation failed:', error);
        return false;
      }
    }
    return false;
  }

  addTransition(fromState, toState, condition) {
    const transitions = this.transitions.get(fromState) || [];
    transitions.push({ toState, condition });
    this.transitions.set(fromState, transitions);
  }

  getCurrentState() {
    return this.currentState;
  }
}

class ErrorRecoveryManager {
  constructor(strategies) {
    this.strategies = strategies;
    this.failureCount = new Map();
  }

  async recover(error, context) {
    const strategy = this.selectStrategy(error, context);
    try {
      const result = await strategy.execute(context);
      if (!result.success) {
        return this.escalate(error, context);
      }
      return result.response;
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      return this.getFallbackResponse(context);
    }
  }

  selectStrategy(error, context) {
    const errorType = this.categorizeError(error);
    const failureCount = this.getFailureCount(errorType);
    
    return this.strategies.find(s => 
      s.canHandle(errorType, failureCount, context)
    ) || this.strategies.find(s => s.isDefault);
  }

  categorizeError(error) {
    if (error.response?.status === 429) return 'rate_limit';
    if (error.code === 'ECONNABORTED') return 'timeout';
    if (error.message.includes('validation')) return 'validation';
    return 'unknown';
  }

  getFailureCount(errorType) {
    const count = this.failureCount.get(errorType) || 0;
    this.failureCount.set(errorType, count + 1);
    return count;
  }

  getFallbackResponse(context) {
    return {
      type: 'multiple_choice',
      content: 'I encountered an issue. How would you like to proceed?',
      options: [
        { id: 'retry', text: 'Try again' },
        { id: 'skip', text: 'Skip to next question' },
        { id: 'restart', text: 'Start over' }
      ]
    };
  }
}

module.exports = {
  ConversationContextManager,
  ResponseSanitizer,
  ConversationStateMachine,
  ErrorRecoveryManager
};
