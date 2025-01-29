const {
  ConversationContextManager,
  ResponseSanitizer,
  ConversationStateMachine,
  ErrorRecoveryManager
} = require('./ContextManager');

class ConversationManager {
  constructor(api) {
    this.api = api;
    this.context = new ConversationContextManager();
    this.sanitizer = new ResponseSanitizer([
      // Add validation rules here
    ]);
    this.stateMachine = new ConversationStateMachine({
      // Add state transition rules here
    });
    this.errorRecovery = new ErrorRecoveryManager([
      // Add recovery strategies here
    ]);
  }

  async processMessage(input, sessionId) {
    try {
      const context = this.context.getContext(sessionId);
      
      // Validate state transition
      const canTransition = await this.stateMachine.transition(input, context);
      if (!canTransition) {
        return this.handleInvalidTransition(input, context);
      }
      
      // Get API response
      const response = await this.getApiResponse(input, context);
      
      // Sanitize response
      const sanitized = await this.sanitizer.sanitize(response, context);
      
      // Update context
      this.context.updateContext(sanitized);
      
      return sanitized;
    } catch (error) {
      return this.errorRecovery.recover(error, context);
    }
  }

  async getApiResponse(input, context) {
    const messages = this.buildMessages(input, context);
    return this.api.getChatCompletion(messages);
  }

  buildMessages(input, context) {
    // Build message array with context
    const messages = [];
    
    // Add system message with current context
    messages.push({
      role: 'system',
      content: this.buildSystemPrompt(context)
    });
    
    // Add conversation history
    const history = context.getMetadata('history') || [];
    messages.push(...history);
    
    // Add current input
    messages.push({
      role: 'user',
      content: input
    });
    
    return messages;
  }

  buildSystemPrompt(context) {
    const section = context.currentSection;
    const sectionContext = context.getSectionContext(section);
    
    return `You are Atlas, a career guidance AI.
Current section: ${section}
Questions in section: ${sectionContext.questionCount}
Last question type: ${sectionContext.lastQuestionType}`;
  }

  handleInvalidTransition(input, context) {
    return {
      type: 'multiple_choice',
      content: 'I\'m not sure how to proceed with that response.',
      question: 'How would you like to continue?',
      options: [
        { id: 'rephrase', text: 'Let me rephrase my response' },
        { id: 'skip', text: 'Skip to the next question' },
        { id: 'help', text: 'I need help understanding what to do' }
      ]
    };
  }
}

module.exports = ConversationManager;
