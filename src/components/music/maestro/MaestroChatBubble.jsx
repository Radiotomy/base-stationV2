import { User } from 'lucide-react';
import MaestroAvatar from './MaestroAvatar';

export default function MaestroChatBubble({ role, text }) {
  const isUser = role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {isUser ? (
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      ) : (
        <MaestroAvatar size={42} />
      )}
      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
        isUser ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'
      }`}>
        {text}
      </div>
    </div>
  );
}