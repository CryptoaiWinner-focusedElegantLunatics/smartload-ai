from sqlmodel import SQLModel, Field
from typing import Optional


class ImapSettings(SQLModel, table=True):
    __tablename__ = "imap_settings"

    id:                Optional[int] = Field(default=None, primary_key=True)
    email_user:        str           = Field(default="")
    email_password:    str           = Field(default="")
    email_imap_server: str           = Field(default="imap.gmail.com")
    email_imap_port:   int           = Field(default=993)