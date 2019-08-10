interface IField {
  title: string;
  value: string;
  short: boolean;
}

interface IAction {
  type: string;
  text: string;
  url: string;
  style?: string;
}
/**
 * See the Attachment structure section in
 *
 * https://api.slack.com/docs/message-attachments
 *
 * for information about each field.
 */
interface IAttachment {
  fallback: string;
  color: string;
  pretext: string;
  author_name: string;
  author_link: string;
  author_icon: string;
  title: string;
  title_link: string;
  text: string;
  fields: IField[];
  actions: IAction[];
  image_url: string;
  thumb_url: string;
  footer: string;
  footer_icon: string;
  ts: number;
}

export { IField, IAction, IAttachment };
