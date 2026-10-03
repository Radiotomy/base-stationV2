import ReactMarkdown from 'react-markdown';
import ArchitectToolCall from './ArchitectToolCall';

export default function ArchitectMessage({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${isUser ? 'merc-button-dark' : 'merc-card'}`}>
        {message.content && (isUser
          ? <p className="whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&_a]:text-accent">{message.content}</ReactMarkdown>)}
        {message.tool_calls?.map((tc, i) => <ArchitectToolCall key={i} toolCall={tc} />)}
      </div>
    </div>
  );
}