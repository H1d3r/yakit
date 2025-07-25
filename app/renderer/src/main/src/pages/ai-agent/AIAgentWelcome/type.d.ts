import {ForwardedRef} from "react"
import {AIStartParams} from "../type/aiChat"

export interface AIAgentWelcomeRef {
    /** 外接触发使用 forge 模板的功能 */
    onTriggerExecForge: (id: number) => void
}

export interface AIAgentWelcomeProps {
    ref?: ForwardedRef<AIAgentWelcomeRef>
    onTriageSubmit: (question: string) => void
    onTaskSubmit: (request: AIStartParams) => void
}
