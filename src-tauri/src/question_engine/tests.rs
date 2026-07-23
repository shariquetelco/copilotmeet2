use super::detector::{classify, QuestionClassification};

fn assert_real_question(text: &str) {
    let decision = classify(text);
    assert_eq!(
        decision.classification,
        QuestionClassification::RealQuestion,
        "Expected '{}' to be RealQuestion, got {:?} ({})",
        text, decision.classification, decision.reason
    );
}

fn assert_ignore(text: &str) {
    let decision = classify(text);
    assert_eq!(
        decision.classification,
        QuestionClassification::Ignore,
        "Expected '{}' to be Ignore, got {:?} ({})",
        text, decision.classification, decision.reason
    );
}

#[test]
fn interview_questions() {
    assert_real_question("Tell me about FRMCS.");
    assert_real_question("How would you improve availability?");
    assert_real_question("What's your experience with Open RAN?");
    assert_real_question("Walk me through your approach to network slicing.");
    assert_real_question("Explain the MAC layer.");
    assert_real_question("Why did you choose that architecture?");
}

#[test]
fn sales_questions() {
    assert_real_question("What's the pricing for this?");
    assert_real_question("Can you compare this to your competitor?");
    assert_real_question("How does the onboarding process work?");
    assert_real_question("Show me the ROI numbers.");
}

#[test]
fn procurement_questions() {
    assert_real_question("What are the compliance requirements?");
    assert_real_question("Describe your vendor evaluation process.");
    assert_real_question("Help me understand the SLA terms.");
}

#[test]
fn legal_questions() {
    assert_real_question("What are the liability terms?");
    assert_real_question("Explain the termination clause.");
    assert_real_question("Who owns the intellectual property here?");
}

#[test]
fn executive_questions() {
    assert_real_question("What's the strategic roadmap for next year?");
    assert_real_question("How does this align with our goals?");
}

#[test]
fn greetings_and_small_talk() {
    assert_ignore("Hello everyone.");
    assert_ignore("Good morning.");
    assert_ignore("Thanks everyone.");
    assert_ignore("Let's get started.");
}

#[test]
fn meeting_logistics_filler() {
    assert_ignore("Can you hear me?");
    assert_ignore("Is this working?");
    assert_ignore("One second.");
    assert_ignore("Are we good to start?");
}

#[test]
fn ambiguous_short_phrases() {
    let decision = classify("Availability...");
    assert_eq!(decision.classification, QuestionClassification::Ambiguous);

    let decision = classify("Security?");
    // short + question mark: our rule checks length AFTER the "?" check,
    // so a single word ending in "?" is still classified RealQuestion —
    // documenting this as the current behavior, not necessarily final.
    assert_eq!(decision.classification, QuestionClassification::RealQuestion);
}

#[test]
fn statements_are_ignored() {
    assert_ignore("That makes sense.");
    assert_ignore("I agree with that approach.");
    assert_ignore("Great, moving on.");
}