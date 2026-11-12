'use client'
import {useLocale} from '@/lib/i18n/locale-context'
import {usePathname} from 'next/navigation'
import {localeOf} from './route-map'
import {msg} from './messages'
import type {Messages} from './en'
export function useCopy(){const l=useLocale();return (s:keyof Messages)=>msg(l,s)}
import {identifierField,type ServiceInputType} from '../service-identifier'
export function useIdentifierCopy(type:ServiceInputType){const l=useLocale(),f=identifierField(type);if(l==='en')return f;return {...f,label:type==='imei'?msg(l,'IMEI number'):type==='serial_or_imei'?'IMEI / S/N':type==='serial'?'S/N':type.toUpperCase(),placeholder:type==='imei'?msg(l,'15-digit IMEI'):type.toUpperCase(),hint:type==='imei'?msg(l,'Dial *#06# or find it in Settings. Check every digit before paying.'):msg(l,'Review eligibility before ordering. Input format validation does not confirm eligibility.'),error:type==='imei'?msg(l,'Enter a valid 15-digit IMEI.'):msg(l,'Edit details')}}
