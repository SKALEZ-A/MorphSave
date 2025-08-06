'use client';

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  Mail, 
  Copy, 
  Share2, 
  MessageCircle, 
  Check,
  ExternalLink,
  Users
} from 'lucide-react';

interface FriendInviteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FriendInvite: React.FC<FriendInviteProps> = ({ isOpen, onClose }) => {
  const [inviteMethod, setInviteMethod] = useState<'email' | 'link' | 'social'>('email');
  const [emailAddresses, setEmailAddresses] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sentEmails, setSentEmails] = useState<string[]>([]);

  const inviteLink = `${window.location.origin}/register?ref=${btoa('user123')}`; // In real app, use actual user ID

  const handleSendEmailInvites = async () => {
    const emails = emailAddresses
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emails.length === 0) return;

    setSending(true);
    try {
      const response = await fetch('/api/social/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails,
          message: personalMessage || undefined
        })
      });

      if (response.ok) {
        setSentEmails(emails);
        setEmailAddresses('');
        setPersonalMessage('');
      }
    } catch (error) {
      console.error('Error sending invites:', error);
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  const handleSocialShare = (platform: 'twitter' | 'facebook' | 'whatsapp') => {
    const message = `Join me on MorphSave - the gamified savings app that makes saving money fun! ${inviteLink}`;
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        break;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Friends to MorphSave">
      <div className="space-y-6">
        <div className="text-center">
          <Users className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">
            Invite your friends to join MorphSave and start saving together! 
            You'll both earn bonus rewards when they sign up.
          </p>
        </div>

        {/* Invite Method Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setInviteMethod('email')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              inviteMethod === 'email'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Mail className="w-4 h-4 inline mr-2" />
            Email
          </button>
          <button
            onClick={() => setInviteMethod('link')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              inviteMethod === 'link'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Copy className="w-4 h-4 inline mr-2" />
            Link
          </button>
          <button
            onClick={() => setInviteMethod('social')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              inviteMethod === 'social'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Share2 className="w-4 h-4 inline mr-2" />
            Social
          </button>
        </div>

        {/* Email Invites */}
        {inviteMethod === 'email' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Addresses
              </label>
              <Input
                type="text"
                placeholder="Enter email addresses separated by commas"
                value={emailAddresses}
                onChange={(e) => setEmailAddresses(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separate multiple email addresses with commas
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Personal Message (Optional)
              </label>
              <textarea
                placeholder="Add a personal message to your invitation..."
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {sentEmails.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 mb-2">
                  <Check className="w-4 h-4" />
                  <span className="font-medium">Invitations Sent!</span>
                </div>
                <p className="text-sm text-green-700">
                  Sent invitations to: {sentEmails.join(', ')}
                </p>
              </div>
            )}

            <Button
              onClick={handleSendEmailInvites}
              disabled={!emailAddresses.trim() || sending}
              className="w-full"
            >
              {sending ? 'Sending Invites...' : 'Send Email Invites'}
            </Button>
          </div>
        )}

        {/* Link Sharing */}
        {inviteMethod === 'link' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Referral Link
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1"
                />
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Share this link with your friends</li>
                <li>• They sign up using your referral link</li>
                <li>• You both get bonus rewards when they make their first save</li>
                <li>• Start saving together and compete in challenges!</li>
              </ul>
            </div>
          </div>
        )}

        {/* Social Sharing */}
        {inviteMethod === 'social' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Share MorphSave with your friends on social media:
            </p>

            <div className="grid grid-cols-1 gap-3">
              <Button
                onClick={() => handleSocialShare('twitter')}
                variant="outline"
                className="flex items-center justify-center gap-3 p-4"
              >
                <div className="w-5 h-5 bg-blue-400 rounded"></div>
                <span>Share on Twitter</span>
                <ExternalLink className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => handleSocialShare('facebook')}
                variant="outline"
                className="flex items-center justify-center gap-3 p-4"
              >
                <div className="w-5 h-5 bg-blue-600 rounded"></div>
                <span>Share on Facebook</span>
                <ExternalLink className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => handleSocialShare('whatsapp')}
                variant="outline"
                className="flex items-center justify-center gap-3 p-4"
              >
                <MessageCircle className="w-5 h-5 text-green-600" />
                <span>Share on WhatsApp</span>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Preview Message:</h4>
              <p className="text-sm text-gray-700 italic">
                "Join me on MorphSave - the gamified savings app that makes saving money fun! 
                We can compete in challenges and help each other reach our financial goals. 
                Sign up and we both get bonus rewards!"
              </p>
            </div>
          </div>
        )}

        {/* Rewards Info */}
        <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Referral Rewards</h4>
          <div className="text-sm text-gray-700 space-y-1">
            <p>• You earn $5 bonus when a friend signs up</p>
            <p>• Your friend gets $5 welcome bonus</p>
            <p>• Unlock exclusive group challenges together</p>
            <p>• Earn extra points for social achievements</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};